import { describe, expect, it } from "vitest";
import { describeEvent, withTradeMints } from "./describe.ts";

const entry = (type: string, payload: Record<string, unknown> = {}) => ({
	id: "e",
	type,
	occurredAt: "",
	payload,
});

describe("saying what a machine did", () => {
	it("names the ordinary moments plainly", () => {
		expect(describeEvent(entry("machine.started"))).toEqual({
			title: "STARTED",
			detail: "WATCHING THE PRICE",
		});
		expect(describeEvent(entry("machine.stopped")).title).toBe("STOPPED");
	});

	it("says where a following band moved to, in dollars", () => {
		expect(
			describeEvent(entry("machine.recentred", { price: "119017205", because: "followed" })),
		).toEqual({ title: "BAND MOVED", detail: "FOLLOWED THE PRICE TO $119.02" });
		expect(
			describeEvent(entry("machine.recentred", { price: "119017205", because: "started" })),
		).toEqual({ title: "BAND SET", detail: "AROUND $119.02" });
	});

	it("says when the owner changed the recipe", () => {
		expect(describeEvent(entry("machine.retuned", { from: "a", to: "b" })).title).toBe(
			"RECIPE CHANGED",
		);
	});

	it("gives the reason a run did nothing, without the code in front of it", () => {
		const skipped = entry("run.skipped", {
			detail: "limit_reached: this machine already holds a position, and holds one at a time",
		});
		expect(describeEvent(skipped)).toEqual({
			title: "DID NOTHING",
			detail: "THIS MACHINE ALREADY HOLDS A POSITION, AND HOLDS ONE AT A TIME",
		});
	});

	it("says what a trade spent and got", () => {
		const traded = entry("trade.completed", { inputAmount: "40350000", outputAmount: "339000000" });
		expect(describeEvent(traded)).toEqual({ title: "TRADED", detail: "SPENT 40.35 · GOT 0.33" });
	});

	it.each([
		["machine.created", {}, "CREATED", "WALLET MADE, POLICY WRITTEN"],
		["machine.paused", {}, "PAUSED", "NOT ACTING UNTIL RESUMED"],
		["machine.resumed", {}, "RESUMED", "WATCHING THE PRICE AGAIN"],
		["machine.limits_changed", { limit: "budgetGranted" }, "LIMIT SET", "BUDGETGRANTED"],
		["machine.limits_changed", {}, "LIMIT SET", ""],
		["run.queued", { wokeOn: "sell" }, "WOKE UP", "SELL"],
		["run.queued", {}, "WOKE UP", "ON SCHEDULE"],
		["run.skipped", {}, "DID NOTHING", ""],
		["trade.intended", {}, "DECIDED TO TRADE", "ASKING FOR A SIGNATURE"],
		["trade.completed", {}, "TRADED", "SPENT 0.00 · GOT 0.00"],
		["trade.simulated", {}, "TRADED ON PAPER", "NO MONEY MOVED"],
		["trade.refused", { reason: "over budget" }, "REFUSED", "OVER BUDGET"],
		["trade.failed", { reason: "expired" }, "TRADE FAILED", "EXPIRED"],
		["sweep.completed", {}, "BANKED PROFIT", "MOVED TO THE VAULT"],
		["withdrawal.completed", {}, "WITHDRAWN", "SENT BACK TO THE OWNER"],
	])("says %s plainly", (type, payload, title, detail) => {
		expect(describeEvent(entry(type, payload))).toEqual({ title, detail });
	});

	it("still says something for a kind of entry it has no words for", () => {
		expect(describeEvent(entry("authority.used")).title).toBe("AUTHORITY USED");
	});
});

describe("a trade, told the right way round", () => {
	const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	const SOL = "So11111111111111111111111111111111111111112";
	const entry = (type: string, payload: Record<string, unknown>, at: string) => ({
		id: `${type}${at}`,
		type,
		occurredAt: at,
		payload,
	});

	it("a sale says what it sold and what came back, each in its own token", () => {
		const [sold] = withTradeMints([
			entry(
				"trade.completed",
				{ tradeId: "s", inputAmount: "331230470", outputAmount: "40350000" },
				"2026-10-02T10:01:00Z",
			),
			entry(
				"trade.intended",
				{ tradeId: "s", inputMint: SOL, outputMint: USDC },
				"2026-10-02T10:00:00Z",
			),
		]);
		expect(describeEvent(sold as never)).toEqual({
			title: "SOLD",
			detail: "0.3312 SOL · GOT 40.35 USDC",
		});
	});

	it("a buy says what it spent and what it got", () => {
		const [bought] = withTradeMints([
			entry(
				"trade.completed",
				{ tradeId: "b", inputAmount: "40350000", outputAmount: "331230470" },
				"2026-10-02T10:01:00Z",
			),
			entry(
				"trade.intended",
				{ tradeId: "b", inputMint: USDC, outputMint: SOL },
				"2026-10-02T10:00:00Z",
			),
		]);
		expect(describeEvent(bought as never)).toEqual({
			title: "BOUGHT",
			detail: "40.35 USDC · GOT 0.3312 SOL",
		});
	});
});
