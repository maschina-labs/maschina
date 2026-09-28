import { describe, expect, it } from "vitest";
import { compactUsd, dayFromMessage } from "./market.ts";

describe("the day's market", () => {
	it("reads the 24 hour ticker", () => {
		const message = {
			e: "24hrTicker",
			c: "118.73",
			P: "-2.143",
			h: "124.95",
			l: "118.14",
			q: "356201337.5",
		};
		expect(dayFromMessage(message)).toEqual({
			last: 118.73,
			changePct: -2.143,
			high: 124.95,
			low: 118.14,
			volumeUsd: 356201337.5,
		});
	});

	it("ignores anything that is not the ticker, or is missing a number", () => {
		expect(dayFromMessage({ e: "kline" })).toBeUndefined();
		expect(
			dayFromMessage({ e: "24hrTicker", c: "x", P: "1", h: "1", l: "1", q: "1" }),
		).toBeUndefined();
		expect(dayFromMessage(null)).toBeUndefined();
	});

	it("says volume short", () => {
		expect(compactUsd(356_201_337)).toBe("356.2M");
		expect(compactUsd(1_420_000_000)).toBe("1.42B");
		expect(compactUsd(4_200)).toBe("4.2K");
		expect(compactUsd(12)).toBe("12");
	});
});
