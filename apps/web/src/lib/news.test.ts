import { describe, expect, it } from "vitest";
import { ago, type NewsItem, picked, sourcesOf } from "./news.ts";

const story = (source: string, solana: boolean, hour: number): NewsItem => ({
	id: `https://example.com/${source}/${hour}`,
	title: `${source} at ${hour}`,
	link: `https://example.com/${source}/${hour}`,
	source,
	publishedAt: `2026-10-03T${String(hour).padStart(2, "0")}:00:00.000Z`,
	solana,
});

const items = [
	story("Decrypt", false, 12),
	story("Solana", true, 11),
	story("Decrypt", true, 10),
	story("Helius", true, 9),
	story("Decrypt", false, 8),
];

describe("the news", () => {
	it("says how long ago, the way people do", () => {
		const now = new Date("2026-10-03T12:00:00.000Z");
		expect(ago("2026-10-03T11:59:40.000Z", now)).toBe("just now");
		expect(ago("2026-10-03T11:59:00.000Z", now)).toBe("1 minute ago");
		expect(ago("2026-10-03T11:35:00.000Z", now)).toBe("25 minutes ago");
		expect(ago("2026-10-03T09:00:00.000Z", now)).toBe("3 hours ago");
		expect(ago("2026-10-02T11:00:00.000Z", now)).toBe("1 day ago");
		expect(ago("2026-09-30T12:00:00.000Z", now)).toBe("3 days ago");
		expect(ago("2026-09-01T12:00:00.000Z", now)).toBe("Sep 1");
	});

	it("lists the sources, the busiest first", () => {
		expect(sourcesOf(items)).toEqual(["Decrypt", "Helius", "Solana"]);
	});

	it("shows everything, only Solana, or one source", () => {
		expect(picked(items, { kind: "all" })).toHaveLength(5);
		expect(picked(items, { kind: "solana" }).map((each) => each.source)).toEqual([
			"Solana",
			"Decrypt",
			"Helius",
		]);
		expect(picked(items, { kind: "source", source: "Decrypt" })).toHaveLength(3);
	});
});
