import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const complete = {
	SIGNER_ORCHESTRATOR_TOKEN: "s".repeat(40),
	DATABASE_URL: "postgres://signer:pw@localhost:5442/maschina",
	SOLANA_RPC_URL: "https://mainnet.helius-rpc.com/?api-key=abc",
	TURNKEY_ORGANIZATION_ID: "org-1",
	TURNKEY_SIGNER_API_PUBLIC_KEY: "02".padEnd(66, "a"),
	TURNKEY_SIGNER_API_PRIVATE_KEY: "b".repeat(64),
};

describe("signer config", () => {
	it("loads with defaults", () => {
		expect(loadConfig(complete)).toMatchObject({
			SIGNER_PORT: 4200,
			TURNKEY_API_BASE_URL: "https://api.turnkey.com",
			SIGNER_FEE_ALLOWANCE_LAMPORTS: 205_000n,
		});
	});

	it("refuses to start without a real token", () => {
		const { SIGNER_ORCHESTRATOR_TOKEN: _, ...rest } = complete;
		expect(() => loadConfig(rest)).toThrow(/SIGNER_ORCHESTRATOR_TOKEN/);
	});

	it.each([
		"DATABASE_URL",
		"SOLANA_RPC_URL",
		"TURNKEY_ORGANIZATION_ID",
		"TURNKEY_SIGNER_API_PUBLIC_KEY",
		"TURNKEY_SIGNER_API_PRIVATE_KEY",
	])("refuses to start without %s", (name) => {
		const rest: Record<string, string> = { ...complete };
		delete rest[name];
		expect(() => loadConfig(rest)).toThrow(new RegExp(name));
	});

	it("never takes the admin key, so the running signer cannot write its own policy", () => {
		const config = loadConfig({ ...complete, TURNKEY_API_PRIVATE_KEY: "c".repeat(64) });
		expect(Object.keys(config)).not.toContain("TURNKEY_API_PRIVATE_KEY");
	});

	it("refuses the public mainnet endpoint in production", () => {
		expect(() =>
			loadConfig({
				...complete,
				NODE_ENV: "production",
				SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
			}),
		).toThrow(/public/);
	});
});
