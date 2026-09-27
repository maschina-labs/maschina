import { describe, expect, it } from "vitest";
import { DEFAULT_SWEEP_THRESHOLD_BPS, sweepDue } from "./float.ts";

/** Fifty dollars, at six decimals, which is the float Ash is funding. */
const FLOAT = 50_000_000n;
/** Two percent of fifty dollars. */
const THRESHOLD = 1_000_000n;

const flat = { target: FLOAT, value: FLOAT, flat: true };

describe("whether profit should be swept", () => {
	it("sweeps everything above the float once the surplus is worth a transaction", () => {
		const decision = sweepDue({ ...flat, value: FLOAT + THRESHOLD });

		expect(decision.sweep).toBe(true);
		expect(decision.amount).toBe(THRESHOLD);
	});

	it("leaves the float itself alone", () => {
		// The whole point: what gets swept is the surplus, and what is left is the stake, exactly.
		const value = FLOAT + 5_000_000n;
		const decision = sweepDue({ ...flat, value });

		expect(decision.amount).toBe(5_000_000n);
		expect(value - decision.amount).toBe(FLOAT);
	});

	it("does nothing for forty cents", () => {
		const decision = sweepDue({ ...flat, value: FLOAT + 400_000n });

		expect(decision.sweep).toBe(false);
		expect(decision.amount).toBe(0n);
	});

	it("does nothing while the machine is holding the other side", () => {
		// Mid-trade the float's value is an opinion, and a sweep against an opinion takes the wrong
		// amount. This is the rule that stops a sweep eating into the stake.
		const decision = sweepDue({ target: FLOAT, value: FLOAT + 10_000_000n, flat: false });

		expect(decision.sweep).toBe(false);
		expect(!decision.sweep && decision.because).toMatch(/holding/i);
	});

	it("does nothing when the machine is below its float", () => {
		const decision = sweepDue({ ...flat, value: FLOAT - 3_000_000n });

		expect(decision.sweep).toBe(false);
		expect(decision.amount).toBe(0n);
	});

	it("does nothing when the machine is exactly on its float", () => {
		expect(sweepDue(flat).sweep).toBe(false);
	});

	it("does nothing for a machine with no float to measure against", () => {
		// Without a line, every cent looks like surplus and the threshold is zero.
		const decision = sweepDue({ target: 0n, value: 400n, flat: true });

		expect(decision.sweep).toBe(false);
		expect(!decision.sweep && decision.because).toMatch(/float/i);
	});
});

describe("the threshold", () => {
	it("is a share of the float, so it means the same thing at any size", () => {
		expect(sweepDue({ target: FLOAT, value: FLOAT, flat: true }).threshold).toBe(THRESHOLD);
		expect(sweepDue({ target: FLOAT * 10n, value: FLOAT * 10n, flat: true }).threshold).toBe(
			THRESHOLD * 10n,
		);
	});

	it("can be raised by an owner who would rather bank in larger pieces", () => {
		const raised = { ...flat, value: FLOAT + 2_000_000n, thresholdBps: 500 };

		expect(sweepDue(raised).threshold).toBe(2_500_000n);
		expect(sweepDue(raised).sweep).toBe(false);
	});

	it("cannot be lowered, because a transaction for a cent is still a transaction", () => {
		const lowered = { ...flat, value: FLOAT + 100_000n, thresholdBps: 1 };

		expect(sweepDue(lowered).threshold).toBe(THRESHOLD);
		expect(sweepDue(lowered).sweep).toBe(false);
	});

	it.each([
		["not a number at all", Number.NaN],
		["not a whole number of basis points", 250.5],
		["negative", -500],
		["beyond anything meaningful", Number.POSITIVE_INFINITY],
	])("falls back to the default when an owner's is %s", (_what, thresholdBps) => {
		const decision = sweepDue({ ...flat, value: FLOAT + THRESHOLD, thresholdBps });

		expect(decision.threshold).toBe(THRESHOLD);
		expect(decision.sweep).toBe(true);
	});

	it("is the number in one place, and conservative", () => {
		expect(DEFAULT_SWEEP_THRESHOLD_BPS).toBe(200);
	});
});
