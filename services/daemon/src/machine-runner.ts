/**
 * Running one machine for one claimed run.
 *
 * The node does the thinking and the signer does the deciding. Here the machine looks at its wallet and
 * decides whether to act. If it does, the trade is quoted, checked against an independent price and
 * built, then proposed. Whether it is allowed, and whether money moves, is the signer's call against
 * the record, never the node's.
 *
 * A machine on paper takes every step of that except the last two: it is quoted and checked the same
 * way, and then the trade is recorded rather than built and signed. The decision it makes is the real
 * decision, which is the only thing paper mode is for.
 *
 * The run can move to another node at any moment. Before each step that could lead to a trade, the node
 * checks it still holds the run, and stops if not.
 */

import type { SignRequest, SignResponse, SimulateRequest } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf, newId } from "@maschina/core";
import { decideFor, type MachineKindRegistry, type SwapAction } from "@maschina/runtime";
import type { ClaimedRun, RunContext } from "./orchestrator-client.ts";
import type { RunExecutor } from "./work-loop.ts";

/** A quote, checked against an independent price. All a machine on paper ever needs. */
export type QuotedTrade = {
	router: string;
	inputMint: string;
	outputMint: string;
	inputAmount: bigint;
	outputAmount: bigint;
	minimumOutputAmount: bigint;
	slippageBps: number;
};

/** A swap built and checked, ready to propose. */
export type PreparedSwap = {
	transaction: Uint8Array;
	lastValidBlockHeight: bigint;
	quote: QuotedTrade;
};

export type MachineRunnerPorts = {
	nodeId: string;
	kinds: MachineKindRegistry;
	context(lease: {
		nodeId: string;
		runId: string;
		leaseEpoch: bigint;
	}): Promise<RunContext | undefined>;
	/** The wallet's balances by mint, read from the chain. SOL is counted under wrapped SOL's mint. */
	balances(wallet: string): Promise<ReadonlyMap<string, BaseUnits>>;
	/** Quotes and checks against the independent price, without building. Says why when it will not. */
	quote(
		action: SwapAction,
		signal: AbortSignal,
	): Promise<{ ok: true; quote: QuotedTrade } | { ok: false; because: string }>;
	/** Quotes, checks against the independent price, and builds. Says why when it will not. */
	prepare(
		action: SwapAction,
		wallet: string,
		signal: AbortSignal,
	): Promise<{ ok: true; swap: PreparedSwap } | { ok: false; because: string }>;
	propose(proposal: {
		nodeId: string;
		leaseEpoch: bigint;
		proposal: SignRequest;
	}): Promise<SignResponse | "lease_lost">;
	/** For a machine on paper: the same trade, with nothing to sign. */
	simulate(proposal: {
		nodeId: string;
		leaseEpoch: bigint;
		proposal: SimulateRequest;
	}): Promise<SignResponse | "lease_lost">;
	now(): Date;
};

const skip = (detail: string) => ({ end: "skipped" as const, reason: "other" as const, detail });
const LOST = "the run moved to another node";

export function machineRunner(ports: MachineRunnerPorts): RunExecutor {
	return async (run: ClaimedRun, lost: AbortSignal) => {
		if (lost.aborted) return skip(LOST);

		const lease = { nodeId: ports.nodeId, runId: run.id, leaseEpoch: run.leaseEpoch };
		const context = await ports.context(lease);
		if (!context) return skip(LOST);

		if (!context.canAct) {
			return {
				end: "skipped",
				reason: context.state === "stopped" ? "machine_stopped" : "machine_paused",
				detail: `the machine is ${context.state}`,
			};
		}

		const kind = ports.kinds.get(context.kind);
		if (!kind) return skip(`this node cannot run a ${context.kind} machine`);

		// On paper the wallet is imaginary, so what it holds comes from the record: what its simulated
		// trades bought, less what they spent, plus whatever of its budget is still to be deployed.
		// Reading the chain instead would refuse every paper machine for having an empty wallet.
		const balances = context.paper
			? paperBalances(kind, context.settings, context, baseUnitsOf(context.availableBudget))
			: await ports.balances(context.wallet);

		const decision = decideFor(kind, context.settings, {
			balances,
			availableBudget: baseUnitsOf(context.availableBudget),
			now: ports.now(),
			...(context.wokeOn === undefined ? {} : { wokeOn: context.wokeOn }),
			totals: {
				spent: baseUnitsOf(context.totals.spent),
				buys: context.totals.buys,
			},
		});

		if (decision.decide === "wait") {
			return decision.because === "budget_exhausted"
				? {
						end: "skipped",
						reason: "budget_exhausted",
						detail: decision.detail ?? "no budget left",
					}
				: skip(decision.detail ? `${decision.because}: ${decision.detail}` : decision.because);
		}
		if (decision.decide === "stop") return skip(decision.because);

		if (lost.aborted) return skip(LOST);

		// On paper the run stops at the quote. Building would hand the router a wallet with nothing in
		// it, and the router would refuse, which says nothing about whether the machine decided well.
		if (context.paper) {
			const quoted = await ports.quote(decision.action, lost);
			if (!quoted.ok) return skip(quoted.because);
			if (lost.aborted) return skip(LOST);

			const answer = await ports.simulate({
				...lease,
				proposal: {
					proposalId: newId<"proposal">(),
					runId: run.id,
					tradeId: newId<"trade">(),
					machineId: run.machineId,
					wallet: context.wallet,
					trade: tradeOf(quoted.quote),
				},
			});
			return answer === "lease_lost" ? skip(LOST) : { end: "finished", failed: false };
		}

		const prepared = await ports.prepare(decision.action, context.wallet, lost);
		if (!prepared.ok) return skip(prepared.because);
		// The last moment to stop: nothing has been proposed yet, so nothing can be signed.
		if (lost.aborted) return skip(LOST);

		const { swap } = prepared;
		const answer = await ports.propose({
			...lease,
			proposal: {
				proposalId: newId<"proposal">(),
				runId: run.id,
				tradeId: newId<"trade">(),
				machineId: run.machineId,
				wallet: context.wallet,
				transaction: Buffer.from(swap.transaction).toString("base64"),
				lastValidBlockHeight: swap.lastValidBlockHeight.toString(),
				trade: tradeOf(swap.quote),
			},
		});
		if (answer === "lease_lost") return skip(LOST);

		// Signed or refused, the run did its job: the signer has recorded which, and why.
		return { end: "finished", failed: false };
	};
}

/** The trade as the record and the rules speak of it: amounts as digits, not numbers. */
const tradeOf = (quote: QuotedTrade): SignRequest["trade"] => ({
	inputMint: quote.inputMint,
	outputMint: quote.outputMint,
	inputAmount: quote.inputAmount.toString(),
	quotedOutputAmount: quote.outputAmount.toString(),
	minimumOutputAmount: quote.minimumOutputAmount.toString(),
	slippageBps: quote.slippageBps,
	router: quote.router,
});

/**
 * What a machine on paper is treated as holding.
 *
 * Two parts. What it bought and has not sold, which the orchestrator works out from the record, and its
 * remaining budget in the currency it spends, which is what it still has to deploy.
 *
 * The budget is used for the spending currency rather than the record's own figure, because the budget
 * is the mandate: an owner can raise or lower it, and what a paper machine may spend is what it is
 * allowed to spend, not what its simulated trades happen to have left over.
 *
 * Without the first part a machine that closes what it opened can never see its own position, and buys
 * the same edge forever.
 */
function paperBalances(
	kind: { budgetMint?: (settings: never) => string; readSettings(settings: unknown): unknown },
	settings: unknown,
	context: Pick<RunContext, "holdings">,
	available: BaseUnits,
): ReadonlyMap<string, BaseUnits> {
	const balances = new Map<string, BaseUnits>(
		[...(context.holdings ?? [])].map(([mint, held]) => [mint, baseUnitsOf(held)]),
	);

	const read = kind.readSettings(settings) as { ok: boolean; value?: never };
	if (read.ok && kind.budgetMint) {
		balances.set(kind.budgetMint(read.value as never), available);
	}
	return balances;
}
