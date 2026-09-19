import type { SignRequest, SignResponse } from "@maschina/contracts";
import { baseUnitsOf, newId } from "@maschina/core";
import { type MachineKind, recurringBuy, registryOf } from "@maschina/runtime";
import { describe, expect, it } from "vitest";
import { type MachineRunnerPorts, machineRunner } from "./machine-runner.ts";
import type { ClaimedRun, RunContext } from "./orchestrator-client.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WALLET = "WaLLet1111111111111111111111111111111111111";

const run: ClaimedRun = {
	id: newId<"run">(),
	machineId: newId<"machine">(),
	occurrenceKey: "2026-09-21T09:00",
	dueAt: new Date("2026-09-21T09:00:00Z"),
	leaseEpoch: 2n,
	leaseExpiresAt: new Date("2026-09-21T09:01:00Z"),
};

const context: RunContext = {
	runId: run.id,
	machineId: run.machineId,
	wallet: WALLET,
	kind: "recurring_buy",
	settings: { spendMint: USDC, buyMint: SOL, amountPerBuy: "5000000", slippageBps: 50 },
	dueAt: run.dueAt,
	state: "running",
	canAct: true,
	availableBudget: 20_000_000n,
	totals: { spent: 0n, buys: 0 },
};

const swap = {
	transaction: new Uint8Array([1, 2, 3]),
	lastValidBlockHeight: 1000n,
	quote: {
		router: "jupiter",
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: 5_000_000n,
		outputAmount: 35_000_000n,
		minimumOutputAmount: 34_800_000n,
		slippageBps: 50,
	},
};

function ports(overrides: Partial<MachineRunnerPorts> = {}) {
	const proposed: SignRequest[] = [];
	const base: MachineRunnerPorts = {
		nodeId: newId<"node">(),
		kinds: registryOf([recurringBuy as MachineKind<never>]),
		context: async () => context,
		balances: async () => new Map([[USDC, baseUnitsOf(50_000_000n)]]),
		prepare: async () => ({ ok: true, swap }),
		propose: async ({ proposal }): Promise<SignResponse> => {
			proposed.push(proposal);
			return { status: "signed", proposalId: proposal.proposalId, signature: "5".repeat(88) };
		},
		now: () => new Date("2026-09-21T09:00:05Z"),
	};
	return { ports: { ...base, ...overrides }, proposed };
}

const live = () => new AbortController().signal;

describe("running a machine", () => {
	it("proposes the trade the machine decided on, for its own wallet and run", async () => {
		const { ports: p, proposed } = ports();
		expect(await machineRunner(p)(run, live())).toEqual({ end: "finished", failed: false });

		expect(proposed).toHaveLength(1);
		expect(proposed[0]).toMatchObject({
			runId: run.id,
			machineId: run.machineId,
			wallet: WALLET,
			transaction: Buffer.from([1, 2, 3]).toString("base64"),
			lastValidBlockHeight: "1000",
			trade: {
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "5000000",
				minimumOutputAmount: "34800000",
			},
		});
	});

	it("counts a refusal by the signer as a run that did its job", async () => {
		const { ports: p } = ports({
			propose: async ({ proposal }) => ({
				status: "refused",
				proposalId: proposal.proposalId,
				by: "maschina",
				rule: "daily_cap",
				reason: "over the cap",
			}),
		});
		expect(await machineRunner(p)(run, live())).toEqual({ end: "finished", failed: false });
	});

	it("skips a machine that is paused or stopped, and says which", async () => {
		const paused = ports({ context: async () => ({ ...context, state: "paused", canAct: false }) });
		expect(await machineRunner(paused.ports)(run, live())).toMatchObject({
			end: "skipped",
			reason: "machine_paused",
		});
		const stopped = ports({
			context: async () => ({ ...context, state: "stopped", canAct: false }),
		});
		expect(await machineRunner(stopped.ports)(run, live())).toMatchObject({
			end: "skipped",
			reason: "machine_stopped",
		});
		expect(paused.proposed).toHaveLength(0);
	});

	it("skips when the machine decides to wait, with its reason", async () => {
		const { ports: p, proposed } = ports({ balances: async () => new Map() });
		const ended = await machineRunner(p)(run, live());
		expect(ended.end).toBe("skipped");
		expect(proposed).toHaveLength(0);
	});

	it("skips, rather than trades, when the quote disagrees with the independent price", async () => {
		const { ports: p, proposed } = ports({
			prepare: async () => ({ ok: false, because: "2% away from the price" }),
		});
		expect(await machineRunner(p)(run, live())).toMatchObject({
			end: "skipped",
			detail: "2% away from the price",
		});
		expect(proposed).toHaveLength(0);
	});

	it("does nothing once the run has moved to another node", async () => {
		const lost = new AbortController();
		lost.abort();
		const { ports: p, proposed } = ports();
		expect((await machineRunner(p)(run, lost.signal)).end).toBe("skipped");
		expect(proposed).toHaveLength(0);
	});

	it("stops before proposing if the run is lost while the trade is being prepared", async () => {
		const lost = new AbortController();
		const { ports: p, proposed } = ports({
			prepare: async () => {
				lost.abort();
				return { ok: true, swap };
			},
		});
		expect((await machineRunner(p)(run, lost.signal)).end).toBe("skipped");
		expect(proposed).toHaveLength(0);
	});

	it("skips a machine of a kind this node does not know", async () => {
		const { ports: p } = ports({ context: async () => ({ ...context, kind: "sniper" }) });
		expect(await machineRunner(p)(run, live())).toMatchObject({ end: "skipped", reason: "other" });
	});

	it("skips when the orchestrator says the node no longer holds the run", async () => {
		const { ports: p } = ports({ context: async () => undefined });
		expect((await machineRunner(p)(run, live())).end).toBe("skipped");
	});
});
