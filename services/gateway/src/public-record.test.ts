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
const refused = (tradeId: string, at: string, by: string, rule: string, reason = "over the cap") =>
	event("trade.refused", at, { runId: "r", tradeId, by, rule, reason });
const simulated = (tradeId: string, at: string, inputMint: string, outputMint: string) =>
	event("trade.simulated", at, {
		runId: "r",
		tradeId,
		inputMint,
		outputMint,
		inputAmount: "24000000",
		quotedOutputAmount: "196600000",
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
		expect(trades.live).toEqual([
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
		expect(trades.live).toEqual([]);
	});

	it("shows only the six public fields: no ids, runs, fees, reasons or addresses can come through", () => {
		const { live: oneTrade } = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, SOL),
				completed("a", "2026-10-01T10:00:04Z", "1000000", "8000000"),
			],
			50,
		);
		expect(Object.keys(oneTrade[0] ?? {}).sort()).toEqual([
			"at",
			"side",
			"signature",
			"sol",
			"usdc",
		]);
	});

	it("skips a trade that is not between USDC and SOL, rather than guessing a side", () => {
		const trades = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, "SomeOtherMint1111111111111111111111111111111"),
				completed("a", "2026-10-01T10:00:04Z", "1000000", "8000000"),
			],
			50,
		);
		expect(trades.live).toEqual([]);
	});

	it("keeps only the most recent trades up to the limit", () => {
		const events: StoredEvent[] = [];
		for (let i = 0; i < 5; i += 1) {
			events.push(intended(`t${i}`, `2026-10-01T1${i}:00:00Z`, USDC, SOL));
			events.push(completed(`t${i}`, `2026-10-01T1${i}:00:04Z`, "1000000", "8000000"));
		}
		const trades = publicTrades(events, 2);
		expect(trades.live.map((trade) => trade.at)).toEqual([
			"2026-10-01T14:00:04.000Z",
			"2026-10-01T13:00:04.000Z",
		]);
	});

	it("keeps paper apart from real money, and gives a paper trade no signature at all", () => {
		// D-096: no total, chart or figure ever adds a paper number to a live one. Two lists make
		// adding them a deliberate act. And a paper machine signed nothing, so there is nothing to
		// link to: the field is absent rather than blank, so no page can render an explorer link for
		// a trade that never happened.
		const record = publicTrades(
			[
				intended("a", "2026-10-01T10:00:00Z", USDC, SOL),
				completed("a", "2026-10-01T10:00:04Z", "24000000", "196600000"),
				simulated("p", "2026-10-01T11:00:00Z", USDC, SOL),
			],
			50,
		);

		expect(record.live).toHaveLength(1);
		expect(record.paper).toEqual([
			{ at: "2026-10-01T11:00:00.000Z", side: "buy", usdc: "24000000", sol: "196600000" },
		]);
		expect(Object.keys(record.paper[0] ?? {})).not.toContain("signature");
	});

	it("reads a paper sale the right way round too", () => {
		const record = publicTrades([simulated("p", "2026-10-01T11:00:00Z", SOL, USDC)], 50);

		expect(record.paper).toEqual([
			{ at: "2026-10-01T11:00:00.000Z", side: "sell", usdc: "196600000", sol: "24000000" },
		]);
	});

	it("limits each list on its own, so a busy paper machine cannot crowd out the real trades", () => {
		const events: StoredEvent[] = [];
		for (let i = 0; i < 5; i += 1) simulated(`p${i}`, `2026-10-01T1${i}:00:00Z`, USDC, SOL);
		for (let i = 0; i < 5; i += 1) {
			events.push(simulated(`p${i}`, `2026-10-01T1${i}:00:00Z`, USDC, SOL));
			events.push(intended(`t${i}`, `2026-10-01T1${i}:30:00Z`, USDC, SOL));
			events.push(completed(`t${i}`, `2026-10-01T1${i}:30:04Z`, "1000000", "8000000"));
		}
		const record = publicTrades(events, 2);

		expect(record.live).toHaveLength(2);
		expect(record.paper).toHaveLength(2);
	});

	it("shows what was proposed and refused, with the amounts from the intent", () => {
		const record = publicTrades(
			[
				intended("t1", "2026-10-01T10:00:00Z", USDC, SOL),
				refused("t1", "2026-10-01T10:00:01Z", "maschina", "budget"),
			],
			50,
		);

		expect(record.refused).toEqual([
			{
				at: "2026-10-01T10:00:01.000Z",
				side: "buy",
				usdc: "1",
				sol: "1",
				by: "maschina",
				rule: "budget",
			},
		]);
		// A refusal is not a trade and never joins either list.
		expect(record.live).toEqual([]);
		expect(record.paper).toEqual([]);
	});

	it("never publishes the reason, which is free text", () => {
		const record = publicTrades(
			[
				intended("t1", "2026-10-01T10:00:00Z", USDC, SOL),
				refused("t1", "2026-10-01T10:00:01Z", "maschina", "budget", "only 4.20 USDC left"),
			],
			50,
		);

		expect(JSON.stringify(record)).not.toContain("4.20");
		expect(Object.keys(record.refused[0] ?? {})).not.toContain("reason");
	});

	it("keeps a rule code it does not know out, rather than passing a string through", () => {
		// The published set is closed. A new rule is published deliberately, by adding it, not by
		// whatever string a service happened to write.
		const record = publicTrades(
			[
				intended("t1", "2026-10-01T10:00:00Z", USDC, SOL),
				refused("t1", "2026-10-01T10:00:01Z", "maschina", "a_rule_from_the_future"),
			],
			50,
		);

		expect(record.refused).toEqual([]);
	});

	it("keeps a refusal from neither gate out", () => {
		const record = publicTrades(
			[
				intended("t1", "2026-10-01T10:00:00Z", USDC, SOL),
				refused("t1", "2026-10-01T10:00:01Z", "somebody_else", "budget"),
			],
			50,
		);

		expect(record.refused).toEqual([]);
	});

	it("leaves out a refusal whose intent it never saw, because it cannot say which way it went", () => {
		const record = publicTrades(
			[refused("t9", "2026-10-01T10:00:01Z", "provider", "recipients")],
			50,
		);

		expect(record.refused).toEqual([]);
	});

	it("says which gate refused it, the provider refusing on its own", () => {
		const record = publicTrades(
			[
				intended("t1", "2026-10-01T10:00:00Z", SOL, USDC),
				refused("t1", "2026-10-01T10:00:01Z", "provider", "provider_policy"),
			],
			50,
		);

		expect(record.refused[0]).toMatchObject({
			side: "sell",
			by: "provider",
			rule: "provider_policy",
		});
	});

	it("limits refusals on their own, like the other two lists", () => {
		const events: StoredEvent[] = [];
		for (let i = 0; i < 5; i += 1) {
			events.push(intended(`t${i}`, `2026-10-01T1${i}:00:00Z`, USDC, SOL));
			events.push(refused(`t${i}`, `2026-10-01T1${i}:00:01Z`, "maschina", "budget"));
		}
		const record = publicTrades(events, 2);

		expect(record.refused).toHaveLength(2);
	});
});
