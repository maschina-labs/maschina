import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const complete = {
	PROVISIONER_GATEWAY_TOKEN: "g".repeat(40),
	DATABASE_URL: "postgres://maschina:pw@localhost:5442/maschina",
	TURNKEY_ORGANIZATION_ID: "org-1",
	TURNKEY_API_PUBLIC_KEY: "02".padEnd(66, "a"),
	TURNKEY_API_PRIVATE_KEY: "a".repeat(64),
	TURNKEY_SIGNER_API_PUBLIC_KEY: "02".padEnd(66, "b"),
	TURNKEY_SIGNER_API_PRIVATE_KEY: "b".repeat(64),
};

describe("provisioner config", () => {
	it("loads with defaults", () => {
		expect(loadConfig(complete)).toMatchObject({
			PROVISIONER_PORT: 4400,
			TURNKEY_API_BASE_URL: "https://api.turnkey.com",
		});
	});

	it.each(Object.keys(complete))("refuses to start without %s", (name) => {
		const rest: Record<string, string> = { ...complete };
		delete rest[name];
		expect(() => loadConfig(rest)).toThrow(new RegExp(name));
	});
});
