import { type BaseUnits, baseUnitsOf, MaschinaError } from "@maschina/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	available,
	type Budget,
	createBudget,
	credit,
	release,
	reserve,
	settle,
} from "./budget.ts";

const units = (n: bigint) => baseUnitsOf(n);

describe("budget", () => {
	it("starts with everything available", () => {
		const budget = createBudget(units(500n));
		expect(available(budget)).toBe(500n);
	});

	it("reserves, then settles at the real cost and frees the difference", () => {
		let budget = createBudget(units(100n));
		budget = reserve(budget, units(30n));
		expect(available(budget)).toBe(70n);
		budget = settle(budget, units(30n), units(25n));
		expect(budget).toEqual({ granted: 100n, reserved: 0n, settled: 25n });
		expect(available(budget)).toBe(75n);
	});

	it("releases a reservation for an action that never happened", () => {
		const budget = release(reserve(createBudget(units(10n)), units(4n)), units(4n));
		expect(available(budget)).toBe(10n);
		expect(budget.settled).toBe(0n);
	});

	it("refuses to start an action it can't cover", () => {
		const budget = reserve(createBudget(units(10n)), units(8n));
		expect(() => reserve(budget, units(3n))).toThrow(MaschinaError);
	});

	it("refuses an action that cost more than was reserved", () => {
		const budget = reserve(createBudget(units(10n)), units(5n));
		expect(() => settle(budget, units(5n), units(6n))).toThrow(/cost more than was reserved/);
	});

	it("refuses to release or settle more than is held", () => {
		const budget = reserve(createBudget(units(10n)), units(2n));
		expect(() => release(budget, units(3n))).toThrow(MaschinaError);
		expect(() => settle(budget, units(3n), units(1n))).toThrow(MaschinaError);
	});

	it("never changes the budget it was given", () => {
		const original = createBudget(units(10n));
		reserve(original, units(5n));
		expect(original.reserved).toBe(0n);
	});

	type Step =
		| { kind: "reserve"; amount: bigint }
		| { kind: "settle"; index: number; fraction: number }
		| { kind: "release"; index: number };

	const step: fc.Arbitrary<Step> = fc.oneof(
		fc.record({
			kind: fc.constant("reserve" as const),
			amount: fc.bigInt({ min: 0n, max: 1_000n }),
		}),
		fc.record({
			kind: fc.constant("settle" as const),
			index: fc.nat(),
			fraction: fc.double({ min: 0, max: 1, noNaN: true }),
		}),
		fc.record({ kind: fc.constant("release" as const), index: fc.nat() }),
	);

	it("holds its invariants through any sequence of actions", () => {
		fc.assert(
			fc.property(
				fc.bigInt({ min: 0n, max: 5_000n }),
				fc.array(step, { maxLength: 60 }),
				(granted, steps) => {
					let budget: Budget = createBudget(units(granted));
					const open: BaseUnits[] = [];
					let spent = 0n;

					for (const s of steps) {
						if (s.kind === "reserve") {
							const amount = units(s.amount);
							if (amount > available(budget)) {
								expect(() => reserve(budget, amount)).toThrow(MaschinaError);
								continue;
							}
							budget = reserve(budget, amount);
							open.push(amount);
						} else if (open.length > 0) {
							const [held] = open.splice(s.index % open.length, 1);
							if (held === undefined) continue;
							if (s.kind === "release") {
								budget = release(budget, held);
							} else {
								const cost = units((held * BigInt(Math.floor(s.fraction * 1000))) / 1000n);
								budget = settle(budget, held, cost);
								spent += cost;
							}
						}

						expect(budget.reserved + budget.settled + available(budget)).toBe(budget.granted);
						expect(available(budget)).toBeGreaterThanOrEqual(0n);
						expect(budget.reserved).toBe(open.reduce((sum, a) => sum + a, 0n));
						expect(budget.settled).toBe(spent);
						expect(budget.settled).toBeLessThanOrEqual(budget.granted);
					}
				},
			),
		);
	});
});

describe("credit", () => {
	const funded = (granted: bigint) => createBudget(baseUnitsOf(granted));

	it("returns money that came back, so the grant is what may be deployed at once", () => {
		const spent = settle(
			reserve(funded(1000n), baseUnitsOf(400n)),
			baseUnitsOf(400n),
			baseUnitsOf(400n),
		);
		expect(available(spent).toString()).toBe("600");

		const returned = credit(spent, baseUnitsOf(400n));
		expect(available(returned).toString()).toBe("1000");
	});

	it("never credits past the grant, because profit is not a wider mandate", () => {
		const spent = settle(
			reserve(funded(1000n), baseUnitsOf(400n)),
			baseUnitsOf(400n),
			baseUnitsOf(400n),
		);

		expect(available(credit(spent, baseUnitsOf(900n))).toString()).toBe("1000");
	});

	it("leaves a reservation alone", () => {
		const holding = reserve(funded(1000n), baseUnitsOf(400n));

		expect(credit(holding, baseUnitsOf(100n)).reserved.toString()).toBe("400");
	});
});
