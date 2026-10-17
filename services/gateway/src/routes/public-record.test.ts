import { PublicRecord, type PublicTrade } from "@maschina/contracts";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";

const logger = createLogger({ service: "test", level: "silent" });

const trade: PublicTrade = {
	at: "2026-10-01T12:00:04.000Z",
	side: "sell",
	usdc: "24360000",
	sol: "196600000",
	signature: "5".repeat(88),
};

function app(read?: () => Promise<PublicRecord>) {
	return buildApp({
		version: "1.0.0",
		corsOrigins: ["http://localhost:3000"],
		logger,
		publicRecord: read ? { read } : undefined,
		machines: {} as never,
		auth: { ownerOf: async () => undefined } as never,
		cookie: { secure: false },
	});
}

describe("the public record API", () => {
	it("serves the trades to anyone, with no sign in, and lets the edge hold them for half a minute", async () => {
		const res = await app(async () => ({ live: [trade], paper: [], refused: [] })).request(
			"/v1/public/record",
		);
		expect(res.status).toBe(200);
		expect(PublicRecord.parse(await res.json()).live).toEqual([trade]);
		expect(res.headers.get("cache-control")).toBe("public, max-age=30");
	});

	it("keeps paper in its own list, with no signature on it", async () => {
		const onPaper = { at: trade.at, side: "buy", usdc: "1000000", sol: "8000000" } as const;
		const res = await app(async () => ({ live: [], paper: [onPaper], refused: [] })).request(
			"/v1/public/record",
		);

		const body = PublicRecord.parse(await res.json());
		expect(body.live).toEqual([]);
		expect(body.paper).toEqual([onPaper]);
	});

	it("refuses a signature on a paper trade, so nothing can present one as real", async () => {
		// Strict schemas both ways: paper has no signature field, so an attempt to add one fails the
		// response rather than reaching a page that would happily link it to an explorer.
		const faked = { ...trade } as unknown as PublicRecord["paper"][number];
		const res = await app(async () => ({ live: [], paper: [faked], refused: [] })).request(
			"/v1/public/record",
		);

		expect(res.status).toBe(500);
	});

	it("cannot leak a field: anything beyond the six public ones fails the response instead of being sent", async () => {
		const leaky = { ...trade, machineId: "m-1", ownerId: "o-1" } as unknown as PublicTrade;
		const res = await app(async () => ({ live: [leaky], paper: [], refused: [] })).request(
			"/v1/public/record",
		);
		expect(res.status).toBe(500);
		expect(await res.text()).not.toContain("o-1");
	});

	it("is empty, plainly, where no owner is chosen to be shown", async () => {
		const res = await app().request("/v1/public/record");
		expect(res.status).toBe(200);
		expect(PublicRecord.parse(await res.json())).toEqual({ live: [], paper: [], refused: [] });
	});
});
