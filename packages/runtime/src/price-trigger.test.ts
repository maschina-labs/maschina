import { describe, expect, it } from "vitest";
import { type CrossingState, observePrice, startWatching } from "./price-trigger.ts";

const LEVEL = 142_000_000n;
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 9, minutes));

const settings = {
	level: LEVEL,
	direction: "falls_to" as const,
	hysteresisBps: 50,
	minGapMs: 15 * 60_000,
};

/** Feeds prices in order and says which of them fired. */
function feed(prices: bigint[], state: CrossingState = startWatching()) {
	const fired: number[] = [];
	let current = state;
	prices.forEach((price, index) => {
		const seen = observePrice(current, { price, now: at(index), ...settings });
		current = seen.state;
		if (seen.fire) fired.push(index);
	});
	return { fired, state: current };
}

describe("a price falling to a level", () => {
	it("fires when the price crosses down, and only then", () => {
		expect(feed([145_000_000n, 143_000_000n, 141_000_000n]).fired).toEqual([2]);
	});

	it("does not fire for a machine that starts below its level", () => {
		// Starting below is not a crossing. The level has to be approached from above first.
		expect(feed([140_000_000n, 139_000_000n]).fired).toEqual([]);
	});

	it("fires once while a price hovers at the level", () => {
		const hovering = [145_000_000n, 141_900_000n, 142_100_000n, 141_800_000n, 142_050_000n];
		expect(feed(hovering).fired).toEqual([1]);
	});

	it("fires again only after the price has moved clear of the level and come back", () => {
		// Clear means past the level by the hysteresis: 0.5% above 142 is 142.71. The gap is out of the
		// way here, because this is about the price, not the clock.
		const prices = [145_000_000n, 141_000_000n, 143_000_000n, 141_000_000n];
		let state = startWatching();
		const fired: number[] = [];
		prices.forEach((price, index) => {
			const seen = observePrice(state, { price, now: at(index), ...settings, minGapMs: 0 });
			state = seen.state;
			if (seen.fire) fired.push(index);
		});
		expect(fired).toEqual([1, 3]);
	});

	it("does not fire a second time inside the minimum gap", () => {
		const soon = { ...settings, minGapMs: 60 * 60_000 };
		let state = startWatching();
		const seen = (price: bigint, minute: number) => {
			const answer = observePrice(state, { price, now: at(minute), ...soon });
			state = answer.state;
			return answer.fire;
		};

		expect(seen(145_000_000n, 0)).toBe(false);
		expect(seen(141_000_000n, 1)).toBe(true);
		expect(seen(143_000_000n, 2)).toBe(false);
		// A real crossing, but too soon after the last run.
		expect(seen(141_000_000n, 3)).toBe(false);
		// The same crossing, once the gap has passed.
		expect(seen(143_000_000n, 60)).toBe(false);
		expect(seen(141_000_000n, 61)).toBe(true);
	});
});

describe("a price rising to a level", () => {
	const rising = { ...settings, direction: "rises_to" as const };

	it("fires when the price crosses up", () => {
		let state = startWatching();
		const seen = (price: bigint, minute: number) => {
			const answer = observePrice(state, { price, now: at(minute), ...rising });
			state = answer.state;
			return answer.fire;
		};

		expect(seen(140_000_000n, 0)).toBe(false);
		expect(seen(143_000_000n, 1)).toBe(true);
		expect(seen(142_500_000n, 2)).toBe(false);
		expect(seen(143_500_000n, 3)).toBe(false);
	});

	it("does not fire for a machine that starts above its level", () => {
		const state = startWatching();
		const answer = observePrice(state, { price: 145_000_000n, now: at(0), ...rising });
		expect(answer.fire).toBe(false);
	});
});

describe("watching", () => {
	it("refuses settings that make no sense", () => {
		const state = startWatching();
		expect(() => observePrice(state, { price: 1n, now: at(0), ...settings, level: 0n })).toThrow(
			/level/,
		);
		expect(() =>
			observePrice(state, { price: 1n, now: at(0), ...settings, hysteresisBps: -1 }),
		).toThrow(/hysteresis/);
		expect(() => observePrice(state, { price: 1n, now: at(0), ...settings, minGapMs: -1 })).toThrow(
			/minimum gap/,
		);
	});
});
