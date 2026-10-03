import { newTrader } from "@maschina/manager";
import { describe, expect, it } from "vitest";
import { traderView } from "./trader-view.ts";

describe("a trader run as the app shows it", () => {
	it("gives dollars with cents, holdings with their worth, and the log newest first", () => {
		const state = newTrader({ id: "r", cash: 40_000_000n, now: new Date("2026-10-03T12:00:00Z") });
		const view = traderView("r", {
			...state,
			book: {
				...state.book,
				cash: 29_995_000n,
				holdings: [
					{
						mint: "W",
						symbol: "WIF",
						decimals: 6,
						amount: 1n,
						cost: 10_005_000n,
						openedAt: new Date(),
					},
				],
			},
			values: { W: "10110000" },
			log: [
				{ at: "a", kind: "buy", text: "first" },
				{ at: "b", kind: "think", text: "second", costUsd: 0.02 },
			],
			think: { ...state.think, lastAt: "b", spentUsd: 0.021234, turns: 1 },
			pausedBecause: "testing",
		});
		expect(view).toMatchObject({
			cash: "29.99",
			worth: "40.10",
			startingCash: "40.00",
			holdings: [{ symbol: "WIF", cost: "10.00", worth: "10.11" }],
			thinking: { spentUsd: 0.0212, turns: 1, lastAt: "b" },
			pausedBecause: "testing",
		});
		expect(view.log.map((entry) => entry.text)).toEqual(["second", "first"]);
		expect(traderView("r", state)).toMatchObject({ holdings: [], log: [] });
		expect(
			traderView("r", {
				...state,
				book: {
					...state.book,
					holdings: [
						{ mint: "X", symbol: "X", decimals: 6, amount: 1n, cost: 1n, openedAt: new Date() },
					],
				},
			}).holdings[0]?.worth,
		).toBeNull();
	});
});
