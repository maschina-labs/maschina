import { describe, expect, it } from "vitest";
import { tabTitle } from "./tab-title.tsx";

describe("the tab title", () => {
	it("carries the live price and which way it moved", () => {
		expect(tabTitle({ usd: 117.754, change24h: -4.7 })).toBe("117.75 ▼ SOL · MASCHINA");
		expect(tabTitle({ usd: 121.2, change24h: 1.1 })).toBe("121.20 ▲ SOL · MASCHINA");
	});

	it("is just the name until there is a price", () => {
		expect(tabTitle(undefined)).toBe("MASCHINA");
	});
});
