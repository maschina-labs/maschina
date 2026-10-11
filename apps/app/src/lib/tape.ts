/**
 * The market's trades as they happen, from Binance's free public stream: each one's price, size, time,
 * and whether a buyer or a seller took it.
 */

export type Print = { id: number; price: number; size: number; at: number; side: "buy" | "sell" };

const STREAM = "wss://data-stream.binance.vision/ws";

/** One aggregated trade message, or nothing if it is not one. Binance marks sells by the buyer being the maker. */
export function printFromMessage(data: unknown): Print | undefined {
	const t = data as Record<string, unknown> | null;
	if (t?.["e"] !== "aggTrade") return undefined;
	const price = Number(t["p"]);
	const size = Number(t["q"]);
	const at = Number(t["T"]);
	const id = Number(t["a"]);
	if (![price, size, at, id].every(Number.isFinite)) return undefined;
	return { id, price, size, at, side: t["m"] === true ? "sell" : "buy" };
}

export function streamPrints(symbol: string, onPrint: (print: Print) => void): () => void {
	const socket = new WebSocket(`${STREAM}/${symbol.toLowerCase()}@aggTrade`);
	socket.onmessage = (event) => {
		const print = printFromMessage(JSON.parse(String(event.data)));
		if (print) onPrint(print);
	};
	return () => socket.close();
}
