import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("daemon config", () => {
	it("loads with defaults", () => {
		expect(
			loadConfig({
				ORCHESTRATOR_URL: "http://localhost:4100",
				ORCHESTRATOR_DAEMON_TOKEN: "d".repeat(40),
			}),
		).toMatchObject({
			DAEMON_HEARTBEAT_MS: 15_000,
			DAEMON_IDENTITY_PATH: ".maschina/daemon-identity.json",
		});
	});

	it("refuses a heartbeat that would hammer the orchestrator", () => {
		expect(() =>
			loadConfig({
				ORCHESTRATOR_URL: "http://localhost:4100",
				ORCHESTRATOR_DAEMON_TOKEN: "d".repeat(40),
				DAEMON_HEARTBEAT_MS: "10",
			}),
		).toThrow();
	});
});
