import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { formatSol, parseAddress, parseCluster, rpcUrlFor, sol } from "./index.ts";

describe("clusters", () => {
	it("accepts the known clusters", () => {
		expect(parseCluster("devnet")).toBe("devnet");
		expect(() => parseCluster("testnet-2")).toThrow(MaschinaError);
	});

	it("uses the configured RPC when there is one", () => {
		expect(rpcUrlFor("mainnet", "https://rpc.example")).toBe("https://rpc.example");
	});

	it("falls back to the public endpoint off mainnet", () => {
		expect(rpcUrlFor("devnet", undefined)).toBe("https://api.devnet.solana.com");
		expect(rpcUrlFor("localnet", undefined)).toBe("http://127.0.0.1:8899");
	});

	it("refuses to trade on mainnet through the public endpoint", () => {
		expect(() => rpcUrlFor("mainnet", undefined)).toThrow(/required on mainnet/);
	});
});

describe("addresses", () => {
	it("accepts a real address", () => {
		const system = "11111111111111111111111111111111";
		expect(parseAddress(system)).toBe(system);
		expect(parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBeDefined();
	});

	it.each(["", "not-an-address", "0x0000000000000000000000000000000000000000", "1".repeat(60)])(
		"refuses %j",
		(value) => {
			expect(() => parseAddress(value)).toThrow(MaschinaError);
		},
	);
});

describe("SOL amounts", () => {
	it("converts between SOL and lamports", () => {
		expect(sol("1")).toBe(1_000_000_000n);
		expect(sol("0.000000001")).toBe(1n);
		expect(formatSol(sol("2.5"))).toBe("2.5");
	});
});
