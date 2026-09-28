import type { RecordEntry } from "./machines.ts";

/**
 * The trades a machine actually made, from its record, as the chart draws them: when, which way, and the
 * price it got. Only completed trades: a trade that was planned or refused moved nothing.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type Trade = { at: number; side: "buy" | "sell"; price: number };

export function tradesFrom(events: RecordEntry[]): Trade[] {
	const intents = new Map<string, { input: string; output: string }>();
	const done = new Set<string>();
	const trades: Trade[] = [];
	for (const event of events) {
		const p = event.payload as Record<string, string>;
		if (event.type === "trade.intended") {
			intents.set(p["tradeId"] ?? "", {
				input: p["inputMint"] ?? "",
				output: p["outputMint"] ?? "",
			});
			continue;
		}
		if (event.type !== "trade.completed") continue;
		const id = p["tradeId"] ?? "";
		const intent = intents.get(id);
		if (!intent || done.has(id)) continue;
		done.add(id);
		const spent = Number(p["inputAmount"] ?? 0);
		const got = Number(p["outputAmount"] ?? 0);
		if (!spent || !got) continue;
		// USDC has six decimals and SOL nine, so dollars per SOL is USDC over SOL, times a thousand.
		const buy = intent.input === USDC;
		const price = buy ? (spent / got) * 1000 : (got / spent) * 1000;
		trades.push({ at: Date.parse(event.occurredAt), side: buy ? "buy" : "sell", price });
	}
	return trades;
}

const SECONDS: Record<string, number> = {
	"5m": 300,
	"15m": 900,
	"1h": 3600,
	"4h": 14_400,
	"1d": 86_400,
};

/**
 * The candle a moment falls in, in the chart's own time: the start of its interval in UTC, shifted by the
 * viewer's offset exactly as the candles are, so a marker sits on the candle it happened in.
 */
export function candleTime(at: number, interval: string, offsetMinutes: number): number {
	const size = SECONDS[interval] ?? 900;
	return Math.floor(at / 1000 / size) * size - offsetMinutes * 60;
}
