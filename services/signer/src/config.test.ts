import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("signer config", () => {
	it("loads with defaults", () => {
		expect(loadConfig({ SIGNER_ORCHESTRATOR_TOKEN: "s".repeat(40) })).toMatchObject({
			SIGNER_PORT: 4200,
		});
	});

	it("refuses to start without a real token", () => {
		expect(() => loadConfig({})).toThrow(/SIGNER_ORCHESTRATOR_TOKEN/);
	});
});
