import { describe, expect, it } from "vitest";
import { printFromMessage } from "./tape.ts";

describe("the market tape", () => {
	it("reads a trade, and which side took it", () => {
		const message = { e: "aggTrade", a: 991, p: "118.42", q: "3.1", T: 1790560000000, m: true };
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
});
