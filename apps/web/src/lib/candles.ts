/**
 * SOL candles for the terminal's chart.
 *
 * For now they come straight from Binance's public market data, which needs no key: the history once, then
 * the live candle over a socket. Birdeye replaces it once the gateway streams prices (its key cannot live
 * in a browser). The chart only ever sees `Candle`, so swapping the source changes nothing else.
 */

export type Candle = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

const REST = "https://data-api.binance.vision/api/v3/klines";
const STREAM = "wss://data-stream.binance.vision/ws";

/**
 * The chart draws times in UTC. Shifting every candle by the viewer's own offset makes the dial along the
 * bottom read in their local time, which is the time they are living in.
 */
const localSeconds = (ms: number, offsetMinutes: number) =>
	Math.floor(ms / 1000) - offsetMinutes * 60;

/** One row of Binance history: open time, then open, high, low and close as strings. */
export function candleFromRow(row: unknown[], offsetMinutes = 0): Candle | undefined {
	const [openTime, open, high, low, close, volume] = row;
	const numbers = [open, high, low, close].map(Number);
	if (typeof openTime !== "number" || numbers.some((n) => !Number.isFinite(n))) return undefined;
	const [o, h, l, c] = numbers as [number, number, number, number];
	// Volume is a nicety: a candle without it is still a candle.
	const v = Number(volume ?? 0);
	return {
		time: localSeconds(openTime, offsetMinutes),
		open: o,
		high: h,
		low: l,
		close: c,
		volume: Number.isFinite(v) ? v : 0,
	};
}

/** One message from the live stream, or nothing if it is not a candle. */
export function candleFromMessage(data: unknown, offsetMinutes = 0): Candle | undefined {
	const k = (data as { k?: Record<string, unknown> } | null)?.k;
	if (!k) return undefined;
	return candleFromRow([k["t"], k["o"], k["h"], k["l"], k["c"], k["v"]], offsetMinutes);
}

export async function fetchCandles(
	symbol: string,
	interval: string,
	limit: number,
	fetcher: typeof fetch = fetch,
	offsetMinutes = new Date().getTimezoneOffset(),
): Promise<Candle[]> {
	const response = await fetcher(`${REST}?symbol=${symbol}&interval=${interval}&limit=${limit}`);
	if (!response.ok) throw new Error(`the price history answered ${response.status}`);
	const rows = (await response.json()) as unknown[][];
	return rows.flatMap((row) => candleFromRow(row, offsetMinutes) ?? []);
}

/** Calls `onCandle` with every live update until the returned function is called. */
export function streamCandles(
	symbol: string,
	interval: string,
	onCandle: (candle: Candle) => void,
	offsetMinutes = new Date().getTimezoneOffset(),
	onLive: (live: boolean) => void = () => {},
): () => void {
	const socket = new WebSocket(`${STREAM}/${symbol.toLowerCase()}@kline_${interval}`);
	socket.onopen = () => onLive(true);
	socket.onclose = () => onLive(false);
	socket.onmessage = (event) => {
		const candle = candleFromMessage(JSON.parse(String(event.data)), offsetMinutes);
		if (candle) onCandle(candle);
	};
	return () => socket.close();
}
