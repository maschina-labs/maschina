import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const complete = {
	ORCHESTRATOR_URL: "http://localhost:4100",
	ORCHESTRATOR_DAEMON_TOKEN: "d".repeat(40),
	SOLANA_RPC_URL: "https://mainnet.helius-rpc.com/?api-key=abc",
};

describe("daemon config", () => {
	it("loads with defaults", () => {
		expect(loadConfig(complete)).toMatchObject({
			DAEMON_HEARTBEAT_MS: 15_000,
			DAEMON_IDENTITY_PATH: ".maschina/daemon-identity.json",
			DAEMON_POLL_MS: 5_000,
			DAEMON_RENEW_MS: 20_000,
			DAEMON_PRIORITY_FEE_LAMPORTS: 200_000n,
		});
	});

	it("refuses a heartbeat that would hammer the orchestrator", () => {
		expect(() => loadConfig({ ...complete, DAEMON_HEARTBEAT_MS: "10" })).toThrow();
	});

	it("refuses to run machines without a chain to read", () => {
		const { SOLANA_RPC_URL: _, ...rest } = complete;
		expect(() => loadConfig(rest)).toThrow(/SOLANA_RPC_URL/);
	});

	it("keeps renewals well inside the lease, so a slow trade never loses its run", () => {
		expect(() => loadConfig({ ...complete, DAEMON_RENEW_MS: "600000" })).toThrow();
	});
});
