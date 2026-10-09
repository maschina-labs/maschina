import { describe, expect, it, vi } from "vitest";
import { printFromMessage, streamPrints } from "./tape.ts";

describe("the market tape", () => {
	const message = { e: "aggTrade", a: 991, p: "118.42", q: "3.1", T: 1790560000000, m: true };

	it("reads a trade, and which side took it", () => {
		expect(printFromMessage(message)).toEqual({
			id: 991,
			price: 118.42,
			size: 3.1,
			at: 1790560000000,
			side: "sell",
		});
		expect(printFromMessage({ ...message, m: false })?.side).toBe("buy");
	});

	it("ignores anything that is not a trade", () => {
		expect(printFromMessage({ e: "kline" })).toBeUndefined();
		expect(printFromMessage(null)).toBeUndefined();
	});

	it("ignores a trade with a number missing", () => {
		expect(printFromMessage({ ...message, p: "not a price" })).toBeUndefined();
	});

	it("streams each trade as it arrives, and stops when asked", () => {
		const sockets: { onmessage?: (event: { data: string }) => void; close: () => void }[] = [];
		vi.stubGlobal(
			"WebSocket",
			class {
				onmessage?: (event: { data: string }) => void;
				close = vi.fn();
				constructor() {
					sockets.push(this);
				}
			},
		);
		const seen: number[] = [];
		const stop = streamPrints("SOLUSDT", (print) => seen.push(print.price));
		sockets[0]?.onmessage?.({ data: JSON.stringify(message) });
		sockets[0]?.onmessage?.({ data: JSON.stringify({ e: "kline" }) });
		expect(seen).toHaveLength(1);
		stop();
		expect(sockets[0]?.close).toHaveBeenCalled();
	});
});
