/**
 * Running one machine for one claimed run.
 *
 * The node does the thinking and the signer does the deciding. Here the machine looks at its wallet and
 * decides whether to act. If it does, the trade is quoted, checked against an independent price and
 * built, then proposed. Whether it is allowed, and whether money moves, is the signer's call against
 * the record, never the node's.
 *
 * The run can move to another node at any moment. Before each step that could lead to a trade, the node
 * checks it still holds the run, and stops if not.
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf, newId } from "@maschina/core";
import { decideFor, type MachineKindRegistry, type SwapAction } from "@maschina/runtime";
import type { ClaimedRun, RunContext } from "./orchestrator-client.ts";
import type { RunExecutor } from "./work-loop.ts";

/** A swap built and checked, ready to propose. */
export type PreparedSwap = {
	transaction: Uint8Array;
	lastValidBlockHeight: bigint;
	quote: {
		router: string;
		inputMint: string;
		outputMint: string;
		inputAmount: bigint;
		outputAmount: bigint;
		minimumOutputAmount: bigint;
		slippageBps: number;
	};
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

		// On paper the wallet is imaginary, so what it "holds" is what the budget allows it to deploy.
		// Reading the chain instead would refuse every paper machine for having an empty wallet, which
		// would make paper mode useless for the one thing it exists for.
		const balances = context.paper
			? paperBalances(kind, context.settings, baseUnitsOf(context.availableBudget))
			: await ports.balances(context.wallet);

		const decision = decideFor(kind, context.settings, {
			balances,
			availableBudget: baseUnitsOf(context.availableBudget),
			now: ports.now(),
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
				trade: {
					inputMint: swap.quote.inputMint,
					outputMint: swap.quote.outputMint,
					inputAmount: swap.quote.inputAmount.toString(),
					quotedOutputAmount: swap.quote.outputAmount.toString(),
					minimumOutputAmount: swap.quote.minimumOutputAmount.toString(),
					slippageBps: swap.quote.slippageBps,
					router: swap.quote.router,
				},
			},
		});
		if (answer === "lease_lost") return skip(LOST);

		// Signed or refused, the run did its job: the signer has recorded which, and why.
		return { end: "finished", failed: false };
	};
}

/**
 * What a machine on paper is treated as holding.
 *
 * Its budget, in the currency it spends. Everything else is empty, so a paper machine is refused for
 * exactly the same reasons a real one would be, apart from the one that cannot apply to it.
 */
function paperBalances(
	kind: { budgetMint?: (settings: never) => string; readSettings(settings: unknown): unknown },
	settings: unknown,
	available: BaseUnits,
): ReadonlyMap<string, BaseUnits> {
	const read = kind.readSettings(settings) as { ok: boolean; value?: never };
	if (!read.ok || !kind.budgetMint) return new Map();
	return new Map([[kind.budgetMint(read.value as never), available]]);
}
