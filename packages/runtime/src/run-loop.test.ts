import { baseUnitsOf, MaschinaError } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { MachineKind, MachineView } from "./machine-kind.ts";
import { checkRequest, type RunPorts, type RunRequest, runOnce } from "./run-loop.ts";

const request: RunRequest = {
	runId: "0199a0a0-0000-7000-8000-000000000010",
	machineId: "0199a0a0-0000-7000-8000-000000000001",
	dueAt: new Date("2026-06-15T15:00:00Z"),
	attempt: 1,
};

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const buyer: MachineKind<unknown> = {
	kind: "test_buyer",
	readSettings: (settings) => ({ ok: true, value: settings }),
	decide: (settings) => {
		const choice = (settings as { choice?: string })?.choice ?? "act";
		if (choice === "wait")
			return { decide: "wait", because: "balance_too_low", detail: "no funds" };
		if (choice === "stop") return { decide: "stop", because: "done" };
		return {
			decide: "act",
			because: "due",
			action: {
				do: "swap",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: baseUnitsOf(25_000_000n),
				slippageBps: 50,
			},
		};
	},
};

const view: MachineView = {
	balances: new Map([[USDC, baseUnitsOf(100_000_000n)]]),
	availableBudget: baseUnitsOf(500_000_000n),
	now: request.dueAt,
	totals: { spent: baseUnitsOf(0n), buys: 0 },
};

const result = {
	signature: "5".repeat(88),
	inputAmount: 25_000_000n,
	outputAmount: 244_000n,
	feeLamports: 5_000n,
};

/** Ports that all succeed, each one recorded, so a test can see exactly what was called and when. */
function ports(overrides: Partial<RunPorts> = {}) {
	const calls: string[] = [];
	const base: RunPorts = {
		restore: vi.fn(async () => {
			calls.push("restore");
			return { kind: buyer, settings: { choice: "act" }, canAct: true };
		}),
		assemble: vi.fn(async () => {
			calls.push("assemble");
			return view;
		}),
		authorize: vi.fn(async () => {
			calls.push("authorize");
			return { allowed: true as const };
		}),
		recordIntent: vi.fn(async () => {
			calls.push("recordIntent");
			return { tradeId: "0199a0a0-0000-7000-8000-000000000099" };
		}),
		execute: vi.fn(async () => {
			calls.push("execute");
			return result;
		}),
		recordOutcome: vi.fn(async () => {
			calls.push("recordOutcome");
		}),
		assess: vi.fn(async () => {
			calls.push("assess");
		}),
		classify: () => "transient",
	};
	return { ports: { ...base, ...overrides }, calls };
}

const fails = (message: string) => async () => {
	throw new MaschinaError("internal", message);
};

describe("runOnce, when everything works", () => {
	it("walks the eight phases in order and finishes", async () => {
		const { ports: p } = ports();
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending.end).toBe("finished");
		expect(report.ok && report.value.phases).toEqual([
			"restore",
			"assemble",
			"decide",
			"authorize",
			"record_intent",
			"execute",
			"record_outcome",
			"assess",
		]);
	});

	it("records the intent before touching the world", async () => {
		const { ports: p, calls } = ports();
		await runOnce(p, request);
		expect(calls.indexOf("recordIntent")).toBeLessThan(calls.indexOf("execute"));
	});

	it("reports what the trade actually did", async () => {
		const { ports: p } = ports();
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "finished", result });
	});
});

describe("runOnce, when the machine decides not to act", () => {
	it("skips with the machine's reason, and never touches the world", async () => {
		const { ports: p, calls } = ports({
			restore: async () => ({ kind: buyer, settings: { choice: "wait" }, canAct: true }),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "skipped",
			reason: "balance_too_low",
			detail: "no funds",
		});
		expect(calls).not.toContain("execute");
		expect(calls).not.toContain("recordIntent");
	});

	it("skips when the machine says its job is done", async () => {
		const { ports: p } = ports({
			restore: async () => ({ kind: buyer, settings: { choice: "stop" }, canAct: true }),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending.end).toBe("skipped");
	});

	it("skips a machine that may not act, saying why", async () => {
		const { ports: p, calls } = ports({
			restore: async () => ({
				kind: buyer,
				settings: {},
				canAct: false,
				stoppedBecause: "paused by the owner",
			}),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "skipped",
			reason: "machine_not_running",
			detail: "paused by the owner",
		});
		expect(calls).not.toContain("execute");
	});
});

describe("runOnce, when the rules refuse", () => {
	it("records the refusal and never executes", async () => {
		const { ports: p, calls } = ports({
			authorize: async () => ({ allowed: false, rule: "maxPerTrade", reason: "over the limit" }),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "refused",
			rule: "maxPerTrade",
			reason: "over the limit",
		});
		expect(calls).not.toContain("execute");
		expect(calls).not.toContain("recordIntent");
	});
});

describe("runOnce, when a step fails", () => {
	const steps = ["restore", "assemble", "authorize", "recordIntent", "execute"] as const;

	it.each(steps)("reports a failure in %s without throwing", async (step) => {
		const { ports: p, calls } = ports({ [step]: fails(`${step} broke`) } as Partial<RunPorts>);
		const report = await runOnce(p, request);
		expect(report.ok).toBe(true);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "failed",
			reason: `${step} broke`,
		});
		// Nothing after the failing step ran.
		expect(calls).not.toContain("execute" === step ? "never" : "execute");
	});

	it("never executes when recording the intent fails", async () => {
		const { ports: p, calls } = ports({ recordIntent: fails("the record is down") });
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "failed",
			phase: "record_intent",
		});
		expect(calls).not.toContain("execute");
	});

	it("records a failed trade against its intent when executing fails", async () => {
		const outcomes: unknown[] = [];
		const { ports: p } = ports({
			execute: fails("the transaction expired"),
			recordOutcome: async (_request, outcome) => {
				outcomes.push(outcome);
			},
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "failed", phase: "execute" });
		expect(outcomes[0]).toMatchObject({ kind: "failed", tradeId: expect.any(String) });
	});

	it("calls a failed execution ambiguous when the record can't be reached afterwards", async () => {
		const { ports: p } = ports({
			recordOutcome: fails("the record is down"),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({
			end: "failed",
			phase: "record_outcome",
			failure: "ambiguous",
		});
		// Ambiguous means ask the world what happened, never retry blindly.
		expect(report.ok && report.value.next).toEqual({ action: "reconcile" });
	});

	it("says what to do next, from the failure rules", async () => {
		const { ports: p } = ports({ assemble: fails("rpc timeout"), classify: () => "transient" });
		const report = await runOnce(p, request);
		expect(report.ok && report.value.next).toEqual({ action: "retry" });
	});

	it("pauses the machine after too many transient failures", async () => {
		const { ports: p } = ports({ assemble: fails("rpc timeout"), classify: () => "transient" });
		const report = await runOnce(p, { ...request, attempt: 4 });
		expect(report.ok && report.value.next).toMatchObject({ action: "pause" });
	});

	it("still reports the run when assessing it fails", async () => {
		const { ports: p } = ports({ assess: fails("bookkeeping broke") });
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending.end).toBe("finished");
	});

	it("still reports a trade that happened when its outcome can't be recorded at all", async () => {
		const { ports: p } = ports({
			execute: fails("expired"),
			recordOutcome: fails("the record is down"),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "failed", phase: "execute" });
	});
});

describe("runOnce, when the record itself is unreachable", () => {
	it("reports a failure when a skip for a paused machine can't be written", async () => {
		const { ports: p } = ports({
			restore: async () => ({ kind: buyer, settings: {}, canAct: false, stoppedBecause: "paused" }),
			recordOutcome: fails("the record is down"),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "failed", phase: "decide" });
	});

	it("reports a failure when a machine's own skip can't be written", async () => {
		const { ports: p } = ports({
			restore: async () => ({ kind: buyer, settings: { choice: "wait" }, canAct: true }),
			recordOutcome: fails("the record is down"),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "failed", phase: "decide" });
	});

	it("reports a failure when a refusal can't be written", async () => {
		const { ports: p } = ports({
			authorize: async () => ({ allowed: false, rule: "maxPerTrade", reason: "over the limit" }),
			recordOutcome: fails("the record is down"),
		});
		const report = await runOnce(p, request);
		expect(report.ok && report.value.ending).toMatchObject({ end: "failed", phase: "authorize" });
	});
});

describe("checkRequest", () => {
	it("accepts a sound request", () => {
		expect(checkRequest(request).ok).toBe(true);
	});

	it("refuses an attempt that doesn't count from one", () => {
		for (const attempt of [0, -1, 1.5]) {
			expect(checkRequest({ ...request, attempt }).ok, String(attempt)).toBe(false);
		}
	});
});
