import type { StoredEvent } from "@maschina/db";
import { describe, expect, it } from "vitest";
import { publicTrades } from "./public-record.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const SIGNATURE = "5".repeat(88);

let counter = 0;
const event = (type: string, at: string, payload: Record<string, unknown>) =>
	({
		id: `e-${++counter}`,
		type,
		occurredAt: new Date(at),
		payload,
	}) as unknown as StoredEvent;

const intended = (tradeId: string, at: string, inputMint: string, outputMint: string) =>
	event("trade.intended", at, {
		runId: "r",
		tradeId,
		inputMint,
		outputMint,
		inputAmount: "1",
		quotedOutputAmount: "1",
		slippageBps: 50,
	});
const completed = (tradeId: string, at: string, inputAmount: string, outputAmount: string) =>
	event("trade.completed", at, {
		runId: "r",
		tradeId,
		signature: SIGNATURE,
		inputAmount,
		outputAmount,
		feeLamports: "5000",
	});

describe("the public trades", () => {
	it("turns a finished buy and a finished sell into trades, newest first, with USDC and SOL named whichever way it went", () => {
		const trades = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, SOL),
				completed("a", "2026-10-01T10:00:04Z", "24000000", "196600000"),
				intended("b", "2026-10-01T12:00:00Z", SOL, USDC),
				completed("b", "2026-10-01T12:00:04Z", "196600000", "24360000"),
			],
			50,
		);
		expect(trades).toEqual([
			{
				at: "2026-10-01T12:00:04.000Z",
				side: "sell",
				usdc: "24360000",
				sol: "196600000",
				signature: SIGNATURE,
			},
			{
				at: "2026-10-01T10:00:04.000Z",
				side: "buy",
				usdc: "24000000",
				sol: "196600000",
				signature: SIGNATURE,
			},
		]);
	});

	it("leaves out everything that is not a finished trade: refusals, failures, an intent that never completed", () => {
		const trades = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, SOL),
				event("trade.refused", "2026-10-01T10:00:01Z", { reason: "secret reason", tradeId: "a" }),
				intended("c", "2026-10-01T11:00:00Z", USDC, SOL),
				event("trade.failed", "2026-10-01T11:00:02Z", { tradeId: "c", reason: "nope" }),
				event("machine.started", "2026-10-01T09:00:00Z", {}),
			],
			50,
		);
		expect(trades).toEqual([]);
	});

	it("shows only the six public fields: no ids, runs, fees, reasons or addresses can come through", () => {
		const [trade] = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, SOL),
				completed("a", "2026-10-01T10:00:04Z", "1000000", "8000000"),
			],
			50,
		);
		expect(Object.keys(trade ?? {}).sort()).toEqual(["at", "side", "signature", "sol", "usdc"]);
	});

	it("skips a trade that is not between USDC and SOL, rather than guessing a side", () => {
		const trades = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, "SomeOtherMint1111111111111111111111111111111"),
				completed("a", "2026-10-01T10:00:04Z", "1000000", "8000000"),
			],
			50,
		);
		expect(trades).toEqual([]);
	});

	it("keeps only the most recent trades up to the limit", () => {
		const events: StoredEvent[] = [];
		for (let i = 0; i < 5; i += 1) {
			events.push(intended(`t${i}`, `2026-10-01T1${i}:00:00Z`, USDC, SOL));
			events.push(completed(`t${i}`, `2026-10-01T1${i}:00:04Z`, "1000000", "8000000"));
		}
		const trades = publicTrades(events, 2);
		expect(trades.map((trade) => trade.at)).toEqual([
			"2026-10-01T14:00:04.000Z",
			"2026-10-01T13:00:04.000Z",
		]);
	});
});
