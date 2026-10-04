import { NewsResponse } from "@maschina/contracts";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { NewsDesk } from "../news.ts";

const logger = createLogger({ service: "test", level: "silent" });

const news = {
	fetchedAt: "2026-10-03T12:00:00.000Z",
	items: [
		{
			id: "https://solana.com/news/open-usd",
			title: "Open USD Is Live on Solana",
			link: "https://solana.com/news/open-usd",
			source: "Solana",
			publishedAt: "2026-10-03T11:00:00.000Z",
			solana: true,
		},
		{
			id: "https://decrypt.co/1",
			title: "Job postings triple",
			link: "https://decrypt.co/1",
			source: "Decrypt",
			publishedAt: "2026-10-03T10:00:00.000Z",
			summary: "Hiring is up.",
			solana: false,
		},
	],
};

function app(desk?: NewsDesk) {
	return buildApp({
		version: "1.0.0",
		corsOrigins: ["http://localhost:3000"],
		logger,
		news: desk,
		machines: {} as never,
		auth: { ownerOf: async () => undefined } as never,
		cookie: { secure: false },
	});
}

describe("the news API", () => {
	it("serves the latest news to anyone, signed in or not", async () => {
		const res = await app({ latest: async () => news }).request("/v1/news");
		expect(res.status).toBe(200);
		const body = NewsResponse.parse(await res.json());
		expect(body.items.map((each) => each.source)).toEqual(["Solana", "Decrypt"]);
		// The same news for everyone, so a browser or the edge can hold it for a minute.
		expect(res.headers.get("cache-control")).toBe("public, max-age=60");
	});

	it("narrows to Solana when asked", async () => {
		const res = await app({ latest: async () => news }).request("/v1/news?about=solana");
		const body = NewsResponse.parse(await res.json());
		expect(body.items.map((each) => each.source)).toEqual(["Solana"]);
	});

	it("refuses a topic it does not know", async () => {
		const res = await app({ latest: async () => news }).request("/v1/news?about=football");
		expect(res.status).toBe(400);
	});

	it("has no news to give where no desk is set up, and says so plainly", async () => {
		const res = await app().request("/v1/news");
		expect(res.status).toBe(200);
		expect(NewsResponse.parse(await res.json()).items).toEqual([]);
	});
});
