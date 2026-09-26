import type { SignRequest, SignResponse, SimulateRequest } from "@maschina/contracts";
import { baseUnitsOf, newId } from "@maschina/core";
import { type MachineKind, recurringBuy, registryOf } from "@maschina/runtime";
import { describe, expect, it, vi } from "vitest";
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
	paper: false,
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
	const simulated: SimulateRequest[] = [];
	const base: MachineRunnerPorts = {
		nodeId: newId<"node">(),
		kinds: registryOf([recurringBuy as MachineKind<never>]),
		context: async () => context,
		balances: async () => new Map([[USDC, baseUnitsOf(50_000_000n)]]),
		quote: async () => ({ ok: true, quote: swap.quote }),
		prepare: async () => ({ ok: true, swap }),
		propose: async ({ proposal }): Promise<SignResponse> => {
			proposed.push(proposal);
			return { status: "signed", proposalId: proposal.proposalId, signature: "5".repeat(88) };
		},
		simulate: async ({ proposal }): Promise<SignResponse> => {
			simulated.push(proposal);
			return { status: "simulated", proposalId: proposal.proposalId, tradeId: proposal.tradeId };
		},
		now: () => new Date("2026-09-21T09:00:05Z"),
	};
	return { ports: { ...base, ...overrides }, proposed, simulated };
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

describe("what woke the run", () => {
	it("is given to the machine, so one waiting on two levels knows which fired", async () => {
		const seen: { wokeOn?: string }[] = [];
		const watching: MachineKind<never> = {
			kind: "recurring_buy",
			readSettings: () => ({ ok: true, value: undefined as never }),
			decide: (_settings, view) => {
				seen.push({ ...(view.wokeOn === undefined ? {} : { wokeOn: view.wokeOn }) });
				return { decide: "wait", because: "not_due" };
			},
		};
		const { ports: p } = ports({
			kinds: registryOf([watching]),
			context: async () => ({ ...context, wokeOn: "low" }),
		});

		await machineRunner(p)(run, live());

		expect(seen).toEqual([{ wokeOn: "low" }]);
	});

	it("is absent for a run that came from a schedule, rather than an empty level", async () => {
		const seen: boolean[] = [];
		const scheduled: MachineKind<never> = {
			kind: "recurring_buy",
			readSettings: () => ({ ok: true, value: undefined as never }),
			decide: (_settings, view) => {
				seen.push("wokeOn" in view);
				return { decide: "wait", because: "not_due" };
			},
		};
		const { ports: p } = ports({ kinds: registryOf([scheduled]) });

		await machineRunner(p)(run, live());

		expect(seen).toEqual([false]);
	});
});

describe("a machine on paper", () => {
	const onPaper = async () => ({ ...context, paper: true });

	it("is treated as holding its budget, so an empty wallet is not a reason to refuse", async () => {
		const balances = vi.fn(async () => new Map());
		const { ports: paper, simulated } = ports({ balances, context: onPaper });

		await machineRunner(paper)(run, live());

		// The chain is never asked: a paper wallet holds nothing, and that is not a refusal.
		expect(balances).not.toHaveBeenCalled();
		expect(simulated).toHaveLength(1);
	});

	it("records the trade it would have made, and never builds or proposes one", async () => {
		const prepare = vi.fn(async () => ({ ok: true as const, swap }));
		const { ports: paper, proposed, simulated } = ports({ prepare, context: onPaper });

		expect(await machineRunner(paper)(run, live())).toEqual({ end: "finished", failed: false });

		// Nothing is built, because building needs a wallet that can pay, and nothing is proposed,
		// because proposing is the path that signs.
		expect(prepare).not.toHaveBeenCalled();
		expect(proposed).toHaveLength(0);
		expect(simulated[0]).toMatchObject({
			runId: run.id,
			machineId: run.machineId,
			wallet: WALLET,
			trade: {
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "5000000",
				quotedOutputAmount: "35000000",
				minimumOutputAmount: "34800000",
			},
		});
	});

	it("skips when the quote disagrees with the independent price, the same as a real machine", async () => {
		const { ports: paper, simulated } = ports({
			context: onPaper,
			quote: async () => ({ ok: false, because: "2% away from the price" }),
		});

		expect(await machineRunner(paper)(run, live())).toMatchObject({
			end: "skipped",
			detail: "2% away from the price",
		});
		expect(simulated).toHaveLength(0);
	});
});
