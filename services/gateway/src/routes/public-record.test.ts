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

function app(read?: () => Promise<PublicTrade[]>) {
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
		const res = await app(async () => [trade]).request("/v1/public/record");
		expect(res.status).toBe(200);
		expect(PublicRecord.parse(await res.json()).trades).toEqual([trade]);
		expect(res.headers.get("cache-control")).toBe("public, max-age=30");
	});

	it("cannot leak a field: anything beyond the six public ones fails the response instead of being sent", async () => {
		const leaky = { ...trade, machineId: "m-1", ownerId: "o-1" } as unknown as PublicTrade;
		const res = await app(async () => [leaky]).request("/v1/public/record");
		expect(res.status).toBe(500);
		expect(await res.text()).not.toContain("o-1");
	});

	it("is empty, plainly, where no machine is chosen to be shown", async () => {
		const res = await app().request("/v1/public/record");
		expect(res.status).toBe(200);
		expect(PublicRecord.parse(await res.json()).trades).toEqual([]);
	});
});
