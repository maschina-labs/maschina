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
import { baseUnitsOf } from "@maschina/core";
import { checkTrade, type PauseReason, type TradeRule } from "@maschina/rules";
import type { TradeSigner } from "./sign-route.ts";

/** Everything the rules need about a machine, read fresh from the record. */
export type MachineFacts = {
	state: string;
	/** The limits as the record holds them: plain numbers, no units attached yet. */
	limits: {
		maxPerTrade?: bigint | undefined;
		maxPerDay?: bigint | undefined;
		approvedMints: readonly string[];
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
		refusal: { rule: TradeRule | "unknown_machine"; reason: string },
	): Promise<void>;
	/** Stops the machine until a person looks at it. */
	pauseMachine(request: SignRequest, reason: PauseReason, detail: string): Promise<void>;
};

export type RuleOptions = {
	now?: () => Date;
	/** How late a run may still act. */
	graceMs?: number;
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
	options: RuleOptions = {},
): TradeSigner {
	const now = options.now ?? (() => new Date());

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

			const decision = checkTrade({
				state: facts.state,
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
					inputAmount: baseUnitsOf(BigInt(request.trade.inputAmount)),
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
	refusal: { rule: TradeRule | "unknown_machine"; reason: string },
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
