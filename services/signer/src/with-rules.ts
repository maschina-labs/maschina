/**
 * Maschina's own rules, between the door and the signature.
 *
 * The wallet provider enforces its own policy, and that is the backstop, not the fence. It knows nothing
 * about budgets, schedules or which machine this is. These checks do, and they run first, so a refusal
 * is recorded in Maschina's own words rather than read back out of a provider error.
 *
 * Everything the rules judge is read from the record at the moment of asking. Nothing is taken from the
 * proposal itself: the caller says what it wants to do, never what it is allowed to do.
 *
 * What happens after a refusal is as much a part of this as the refusal:
 *
 *   - the refusal is written to the record, so the owner can see exactly what stopped it
 *   - a rule whose breach means something is wrong pauses the machine as well
 *   - a failure to write either of those refuses the trade, because an unrecorded refusal is a lie
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { baseUnitsOf, type MaschinaError, type Result } from "@maschina/core";
import {
	checkQuote,
	checkTrade,
	DEFAULT_MAX_PRICE_IMPACT_BPS,
	DEFAULT_MAX_SLIPPAGE_BPS,
	type PauseReason,
	type QuoteRule,
	type TradeRule,
} from "@maschina/rules";
import { gainOf, judgeSwap, type WalletEffects } from "@maschina/solana";
import type { TradeSigner } from "./sign-route.ts";

/**
 * What the transaction would really do to the machine's wallet (F-01, D-120).
 *
 * Required rather than optional on purpose. A signer assembled without one would quietly go back to
 * judging the caller's description of its own trade, which is the hole this closes, and a hole that
 * reopens when somebody forgets a parameter is not closed.
 */
export type MeasureTrade = (request: SignRequest) => Promise<Result<WalletEffects, MaschinaError>>;

/**
 * Every code the rule layer can refuse under.
 *
 * Wider than `TradeRule` because two of these are not judgements about a trade at all. One says the
 * machine or run does not exist; two say the transaction could not be measured, or was measured and
 * did not match its own description. All of them are codes rather than sentences, because the code
 * is what the public record publishes and the sentence is what stays private (D-119).
 */
type RefusalRule =
	| TradeRule
	| QuoteRule
	| "unknown_machine"
	| "simulation_failed"
	| "derived_mismatch";

/** What one token account costs to open, and gives back when it closes. */
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;

/**
 * The most SOL a swap may consume beyond the trade itself.
 *
 * A swap pays a transaction fee, a priority fee, and rent for at most two token accounts: the wrapped
 * SOL account it opens and closes, and the account the bought token lands in. Beyond that, SOL
 * leaving the wallet is not part of a swap.
 *
 * It has to be tight rather than generous, because a SOL sale is held to the claim plus this number:
 * every lamport of slack here is a lamport that could leave a wallet unexplained on every trade.
 */
export const lamportsBeyondTheTrade = (feeAllowance: bigint): bigint =>
	feeAllowance + 2n * TOKEN_ACCOUNT_RENT_LAMPORTS;

/** Everything the rules need about a machine, read fresh from the record. */
export type MachineFacts = {
	state: string;
	/** The currency the budget and caps are counted in. A trade that spends anything else is a sale. */
	budgetMint?: string | undefined;
	/** The limits as the record holds them: plain numbers, no units attached yet. */
	limits: {
		maxPerTrade?: bigint | undefined;
		maxPerDay?: bigint | undefined;
		approvedMints: readonly string[];
		/** The widest slippage a quote may accept. Absent means the rules' own ceiling, never none. */
		maxSlippageBps?: number | undefined;
		/** The largest price impact a trade may have. Absent means the rules' own ceiling. */
		maxPriceImpactBps?: number | undefined;
	};
	availableBudget: bigint;
	spentToday: bigint;
	/** The moment the run was scheduled for, from the queue rather than from the caller. */
	dueAt: Date;
};

export type RecordKeeper = {
	/** Reads what the rules judge. Returns nothing when the machine or run is unknown. */
	factsFor(request: SignRequest): Promise<MachineFacts | undefined>;
	/** Writes the refusal to the record. */
	recordRefusal(
		request: SignRequest,
		refusal: { rule: RefusalRule; reason: string },
	): Promise<void>;
	/** Stops the machine until a person looks at it. */
	pauseMachine(request: SignRequest, reason: PauseReason, detail: string): Promise<void>;
};

export type RuleOptions = {
	now?: () => Date;
	/** How late a run may still act. */
	graceMs?: number;
	/** The most SOL fees and rent may account for. See `lamportsBeyondTheTrade`. */
	lamportsAllowed?: bigint;
};

/**
 * Wraps a signer so nothing reaches it without passing Maschina's rules.
 *
 * The wrapping is the point: there is no path to the inner signer that skips this, and no flag that
 * turns it off. A signer that can be asked to skip its rules is a signer that will be.
 */
export function withRules(
	inner: TradeSigner,
	record: RecordKeeper,
	measure: MeasureTrade,
	options: RuleOptions = {},
): TradeSigner {
	const now = options.now ?? (() => new Date());
	const lamportsAllowed = options.lamportsAllowed ?? lamportsBeyondTheTrade(0n);

	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			const facts = await record.factsFor(request);

			if (!facts) {
				// A proposal about a machine or run the record does not know is not a trade to judge, it is
				// a question about something that does not exist.
				return refuseWith(record, request, {
					rule: "unknown_machine",
					reason: "the record has no such machine and run",
				});
			}

			// Whether the price it accepted is one the owner allowed. Before the simulation, because
			// a quote the owner forbade is not worth asking a node about, and because `judgeSwap`
			// below holds the bytes to `minimumOutputAmount`: that floor has to be checked by
			// somebody other than the party who supplied it, or it is not a floor.
			const quote = checkQuote({
				quotedOutputAmount: baseUnitsOf(BigInt(request.trade.quotedOutputAmount)),
				minimumOutputAmount: baseUnitsOf(BigInt(request.trade.minimumOutputAmount)),
				slippageBps: request.trade.slippageBps,
				priceImpactBps: request.trade.priceImpactBps,
				maxSlippageBps: facts.limits.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS,
				maxPriceImpactBps: facts.limits.maxPriceImpactBps ?? DEFAULT_MAX_PRICE_IMPACT_BPS,
			});
			if (!quote.allowed) {
				if (quote.pause) await record.pauseMachine(request, quote.pause, quote.reason);
				return refuseWith(record, request, { rule: quote.rule, reason: quote.reason });
			}

			// What the bytes would really do. Asked after the machine is known, so nothing is
			// simulated on behalf of something that does not exist, and before the rules, because
			// the rules are about to judge these numbers rather than the caller's description.
			const measured = await measure(request);
			if (!measured.ok) {
				// An outage is not the machine's fault, so it is refused and left able to try again.
				return refuseWith(record, request, {
					rule: "simulation_failed",
					reason: measured.error.message,
				});
			}

			const honest = judgeSwap(measured.value, {
				inputMint: request.trade.inputMint,
				outputMint: request.trade.outputMint,
				inputAmount: baseUnitsOf(BigInt(request.trade.inputAmount)),
				minimumOutputAmount: baseUnitsOf(BigInt(request.trade.minimumOutputAmount)),
				lamportsAllowed: baseUnitsOf(lamportsAllowed),
			});
			if (!honest.ok) {
				// A node lying about its own trade has stopped being trustworthy. That is not an
				// owner's limit saying no, so the machine stops rather than trying again.
				await record.pauseMachine(request, "other", honest.problem);
				return refuseWith(record, request, { rule: honest.rule, reason: honest.problem });
			}

			// The same arithmetic `judgeSwap` was just held to, deliberately: a sold SOL moves as
			// native lamports rather than as a token, so reading the token alone measures the spend
			// as nothing, and nothing is inside every cap there is.
			const spent = -gainOf(measured.value, request.trade.inputMint);

			const decision = checkTrade({
				state: facts.state,
				budgetMint: facts.budgetMint,
				limits: {
					approvedMints: facts.limits.approvedMints,
					...(facts.limits.maxPerTrade === undefined
						? {}
						: { maxPerTrade: baseUnitsOf(facts.limits.maxPerTrade) }),
					...(facts.limits.maxPerDay === undefined
						? {}
						: { maxPerDay: baseUnitsOf(facts.limits.maxPerDay) }),
				},
				availableBudget: baseUnitsOf(facts.availableBudget),
				spentToday: baseUnitsOf(facts.spentToday),
				trade: {
					inputMint: request.trade.inputMint,
					outputMint: request.trade.outputMint,
					// Measured, never claimed. This line is the whole of F-01.
					inputAmount: baseUnitsOf(spent > 0n ? spent : 0n),
				},
				run: { dueAt: facts.dueAt },
				now: now(),
				...(options.graceMs === undefined ? {} : { graceMs: options.graceMs }),
			});

			if (decision.allowed) return inner.sign(request);

			if (decision.pause) {
				await record.pauseMachine(request, decision.pause, decision.reason);
			}
			return refuseWith(record, request, { rule: decision.rule, reason: decision.reason });
		},
	};
}

/** Records a refusal and reports it. The record is written first: an unrecorded refusal is a lie. */
async function refuseWith(
	record: RecordKeeper,
	request: SignRequest,
	refusal: { rule: RefusalRule; reason: string },
): Promise<SignResponse> {
	await record.recordRefusal(request, refusal);
	return {
		status: "refused",
		proposalId: request.proposalId,
		by: "maschina",
		rule: refusal.rule,
		reason: refusal.reason,
	};
}
