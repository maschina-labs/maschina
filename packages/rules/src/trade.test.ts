import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { checkTrade, type TradeCheck } from "./trade.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

const NOW = new Date("2026-09-18T15:00:00.000Z");
const amount = (value: bigint) => baseUnitsOf(value);

/** A trade that passes every rule, with one thing changed per test. */
const check = (over: Partial<TradeCheck> = {}): TradeCheck => ({
	state: "running",
	limits: {
		maxPerTrade: amount(500_000_000n),
		maxPerDay: amount(1_000_000_000n),
		approvedMints: [SOL, USDC],
	},
	availableBudget: amount(5_000_000_000n),
	spentToday: amount(0n),
	trade: { inputMint: SOL, outputMint: USDC, inputAmount: amount(100_000_000n) },
	run: { dueAt: NOW },
	now: NOW,
	...over,
});

describe("before a signature", () => {
	it("allows a trade that breaks nothing", () => {
		expect(checkTrade(check())).toEqual({ allowed: true });
	});
});

describe("the machine has to be running", () => {
	it.each(["paused", "stopped", "draft", "ready"])("refuses a machine that is %s", (state) => {
		const decision = checkTrade(check({ state }));

		expect(decision).toMatchObject({ allowed: false, rule: "machine_running" });
	});

	it("does not pause a machine that has already stopped", () => {
		const decision = checkTrade(check({ state: "paused" }));

		expect(decision.allowed).toBe(false);
		expect(decision).not.toHaveProperty("pause");
	});

	it("is asked before anything else, so a stopped machine is never judged on its budget", () => {
		const decision = checkTrade(
			check({ state: "stopped", availableBudget: amount(0n), limits: { approvedMints: [] } }),
		);

		expect(decision).toMatchObject({ rule: "machine_running" });
	});
});

describe("the run has to be the one it says it is", () => {
	it("allows a run a little late, because everything takes a moment", () => {
		const now = new Date(NOW.getTime() + 5 * 60_000);

		expect(checkTrade(check({ now })).allowed).toBe(true);
	});

	it("refuses a run past its grace period, because the price belongs to another moment", () => {
		const now = new Date(NOW.getTime() + 2 * 60 * 60_000);

		const decision = checkTrade(check({ now }));

		expect(decision).toMatchObject({ allowed: false, rule: "run_due" });
		expect(decision).toMatchObject({ reason: expect.stringContaining("grace") });
	});

	it("takes the grace period as a setting", () => {
		const now = new Date(NOW.getTime() + 10 * 60_000);

		expect(checkTrade(check({ now, graceMs: 30 * 60_000 })).allowed).toBe(true);
		expect(checkTrade(check({ now, graceMs: 60_000 })).allowed).toBe(false);
	});

	it("allows the small clock differences between two machines", () => {
		const now = new Date(NOW.getTime() - 10_000);

		expect(checkTrade(check({ now })).allowed).toBe(true);
	});

	it("refuses a run that is not due yet, and stops the machine", () => {
		const now = new Date(NOW.getTime() - 10 * 60_000);

		const decision = checkTrade(check({ now }));

		// Something proposed a trade before its time. That is a fault upstream, not a normal refusal.
		expect(decision).toMatchObject({ allowed: false, rule: "run_due", pause: "other" });
	});
});

describe("both tokens have to be approved", () => {
	it("refuses a token the owner never approved, and stops the machine", () => {
		const decision = checkTrade(
			check({ trade: { inputMint: SOL, outputMint: JUP, inputAmount: amount(1n) } }),
		);

		expect(decision).toMatchObject({ allowed: false, rule: "token_approved", pause: "other" });
		expect(decision).toMatchObject({ reason: expect.stringContaining(JUP) });
	});

	it("checks what is being spent as well as what is being bought", () => {
		const decision = checkTrade(
			check({ trade: { inputMint: JUP, outputMint: USDC, inputAmount: amount(1n) } }),
		);

		expect(decision).toMatchObject({ rule: "token_approved" });
		expect(decision).toMatchObject({ reason: expect.stringContaining(JUP) });
	});

	it("approves nothing when the list is empty, rather than everything", () => {
		const decision = checkTrade(check({ limits: { approvedMints: [] } }));

		expect(decision).toMatchObject({ allowed: false, rule: "token_approved" });
	});
});

describe("the caps", () => {
	it("refuses a trade larger than one trade may be, and stops the machine", () => {
		const decision = checkTrade(
			check({ trade: { inputMint: SOL, outputMint: USDC, inputAmount: amount(500_000_001n) } }),
		);

		expect(decision).toMatchObject({ allowed: false, rule: "per_trade_cap", pause: "other" });
	});

	it("allows a trade exactly at the per-trade cap", () => {
		expect(
			checkTrade(
				check({ trade: { inputMint: SOL, outputMint: USDC, inputAmount: amount(500_000_000n) } }),
			).allowed,
		).toBe(true);
	});

	it("counts today's spending towards the daily cap", () => {
		const decision = checkTrade(
			check({
				spentToday: amount(950_000_000n),
				limits: { ...check().limits, maxPerDay: amount(1_000_000_000n) },
			}),
		);

		expect(decision).toMatchObject({ allowed: false, rule: "daily_cap" });
	});

	it("does not pause for a daily cap, because tomorrow it resets", () => {
		const decision = checkTrade(check({ spentToday: amount(1_000_000_000n) }));

		expect(decision.allowed).toBe(false);
		expect(decision).not.toHaveProperty("pause");
	});

	it("allows spending that lands exactly on the daily cap", () => {
		const decision = checkTrade(check({ spentToday: amount(900_000_000n) }));

		expect(decision.allowed).toBe(true);
	});

	it("applies no cap when the owner set none", () => {
		const decision = checkTrade(
			check({
				limits: { approvedMints: [SOL, USDC] },
				trade: { inputMint: SOL, outputMint: USDC, inputAmount: amount(4_000_000_000n) },
			}),
		);

		expect(decision.allowed).toBe(true);
	});
});

describe("the budget", () => {
	it("refuses a trade the budget cannot cover, and pauses for the owner", () => {
		const decision = checkTrade(
			check({ availableBudget: amount(99_999_999n), limits: { approvedMints: [SOL, USDC] } }),
		);

		expect(decision).toMatchObject({
			allowed: false,
			rule: "budget",
			pause: "budget_exhausted",
		});
	});

	it("allows a trade that spends the last of the budget", () => {
		expect(checkTrade(check({ availableBudget: amount(100_000_000n) })).allowed).toBe(true);
	});

	it("is asked last, so a cap is reported before an empty budget", () => {
		const decision = checkTrade(
			check({
				availableBudget: amount(0n),
				spentToday: amount(1_000_000_000n),
			}),
		);

		expect(decision).toMatchObject({ rule: "daily_cap" });
	});
});
