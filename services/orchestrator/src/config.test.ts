import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const valid = {
	DATABASE_URL: "postgres://maschina_app:x@localhost:5442/maschina",
	ORCHESTRATOR_DAEMON_TOKEN: "d".repeat(40),
	SIGNER_URL: "http://signer:4200",
	SIGNER_ORCHESTRATOR_TOKEN: "s".repeat(40),
};

describe("orchestrator config", () => {
	it("loads with defaults", () => {
		expect(loadConfig(valid)).toMatchObject({ ORCHESTRATOR_PORT: 4100, SERVICE_VERSION: "dev" });
	});

	it("refuses to start without the signer's address and token", () => {
		const { SIGNER_URL: _, ...rest } = valid;
		expect(() => loadConfig(rest)).toThrow(/SIGNER_URL/);
	});

	it("refuses to start without a database or a real token", () => {
		expect(() => loadConfig({})).toThrow(/DATABASE_URL[\s\S]*ORCHESTRATOR_DAEMON_TOKEN/);
		expect(() =>
			loadConfig({ ...valid, ORCHESTRATOR_DAEMON_TOKEN: "replace-with-a-real-value" }),
		).toThrow();
	});
});
