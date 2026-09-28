import { describe, expect, it } from "vitest";
import { tabTitle } from "./tab-title.tsx";

describe("the tab title", () => {
	it("is the live price, then the name", () => {
		expect(tabTitle({ usd: 117.754, change24h: -4.7 })).toBe("117.75 | Maschina");
	});

	it("is just the name until there is a price", () => {
		expect(tabTitle(undefined)).toBe("Maschina");
	});
});
