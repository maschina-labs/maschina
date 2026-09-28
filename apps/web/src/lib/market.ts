/**
 * The day's market for SOL, streamed: last price, the move, the high and low, and how much traded. From
 * Binance's free public stream, the same place as the candles, until the gateway streams prices itself.
 */

export type Day = { last: number; changePct: number; high: number; low: number; volumeUsd: number };

const STREAM = "wss://data-stream.binance.vision/ws";

/** One message of the 24 hour ticker, or nothing if it is not one. */
export function dayFromMessage(data: unknown): Day | undefined {
	const t = data as Record<string, unknown> | null;
	if (!t || t["e"] !== "24hrTicker") return undefined;
	const [last, changePct, high, low, volumeUsd] = [t["c"], t["P"], t["h"], t["l"], t["q"]].map(
		Number,
	);
	const all = [last, changePct, high, low, volumeUsd];
	if (all.some((n) => n === undefined || !Number.isFinite(n))) return undefined;
	return {
		last: last as number,
		changePct: changePct as number,
		high: high as number,
		low: low as number,
		volumeUsd: volumeUsd as number,
	};
}

/** Dollars traded, short: 348.2M, 1.4B. */
export function compactUsd(n: number): string {
	if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
	return n.toFixed(0);
}

export function streamDay(
	symbol: string,
	onDay: (day: Day) => void,
	onLive: (live: boolean) => void = () => {},
): () => void {
	const socket = new WebSocket(`${STREAM}/${symbol.toLowerCase()}@ticker`);
	socket.onopen = () => onLive(true);
	socket.onclose = () => onLive(false);
	socket.onmessage = (event) => {
		const day = dayFromMessage(JSON.parse(String(event.data)));
		if (day) onDay(day);
	};
	return () => socket.close();
}
