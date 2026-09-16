import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("bots config", () => {
	it("runs without any platform configured", () => {
		const config = loadConfig({ GATEWAY_URL: "http://localhost:4000", TELEGRAM_BOT_TOKEN: "" });
		expect(config.TELEGRAM_BOT_TOKEN).toBeUndefined();
		expect(config.BOTS_PORT).toBe(4300);
	});

	it("refuses a malformed token", () => {
		expect(() =>
			loadConfig({ GATEWAY_URL: "http://localhost:4000", TELEGRAM_BOT_TOKEN: "short" }),
		).toThrow();
	});
});
