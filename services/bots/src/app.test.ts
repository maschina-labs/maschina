import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { enabledPlatforms } from "./platforms.ts";

describe("bots", () => {
	it("reports health and which platforms are on", async () => {
		const app = buildApp({
			version: "1.0.0",
			platforms: ["telegram"],
			logger: createLogger({ service: "t", level: "silent" }),
		});
		expect((await app.request("/health")).status).toBe(200);
		expect(await (await app.request("/platforms")).json()).toEqual({ enabled: ["telegram"] });
	});
});

describe("enabledPlatforms", () => {
	it("turns a platform on only when it has credentials", () => {
		expect(enabledPlatforms({})).toEqual([]);
		expect(enabledPlatforms({ TELEGRAM_BOT_TOKEN: "123:abc" })).toEqual(["telegram"]);
	});
});
