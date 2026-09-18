import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { CLUSTERS } from "./cluster.ts";
import type { MintDetails } from "./mint.ts";
import {
	approvedTokens,
	checkMintMatches,
	findApprovedSymbol,
	findApprovedToken,
	requireApprovedToken,
} from "./token-list.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const details = (over: Partial<MintDetails> = {}): MintDetails => ({
	mint: parseAddress(USDC),
	program: "token",
	decimals: 6,
	supply: 1n,
	extensions: [],
	...over,
});

describe("the approved list", () => {
	it("has SOL and a dollar on every cluster", () => {
		for (const cluster of CLUSTERS) {
			expect(findApprovedSymbol(cluster, "SOL")?.decimals).toBe(9);
			expect(approvedTokens(cluster).some((entry) => entry.symbol.includes("USD"))).toBe(true);
		}
	});

	it("never lists the same mint twice on one cluster", () => {
		for (const cluster of CLUSTERS) {
			const mints = approvedTokens(cluster).map((entry) => entry.mint);
			expect(new Set(mints).size).toBe(mints.length);
		}
	});

	it("never lists the same symbol twice on one cluster", () => {
		for (const cluster of CLUSTERS) {
			const symbols = approvedTokens(cluster).map((entry) => entry.symbol);
			expect(new Set(symbols).size).toBe(symbols.length);
		}
	});

	it("finds an approved token by mint", () => {
		expect(findApprovedToken("mainnet", USDC)?.symbol).toBe("USDC");
		expect(requireApprovedToken("mainnet", USDC).decimals).toBe(6);
	});

	it("matches symbols exactly, because case is not a detail here", () => {
		expect(findApprovedSymbol("mainnet", "usdc")).toBeUndefined();
	});

	it("refuses a token nobody approved", () => {
		const unknown = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
		expect(findApprovedToken("mainnet", unknown)).toBeUndefined();
		expect(() => requireApprovedToken("mainnet", unknown)).toThrow(/not approved/);
	});

	it("does not approve a devnet token on mainnet", () => {
		const devnetOnly = approvedTokens("devnet").find((entry) => entry.symbol === "devUSDC");
		expect(devnetOnly).toBeDefined();
		expect(() => requireApprovedToken("mainnet", devnetOnly?.mint ?? "")).toThrow(MaschinaError);
	});
});

describe("holding the list against the chain", () => {
	it("passes when the chain agrees", () => {
		expect(() => checkMintMatches(requireApprovedToken("mainnet", USDC), details())).not.toThrow();
	});

	it("refuses decimals the list got wrong, which would scale every amount", () => {
		expect(() =>
			checkMintMatches(requireApprovedToken("mainnet", USDC), details({ decimals: 9 })),
		).toThrow(/9 decimals on chain/);
	});

	it("refuses details for a different mint", () => {
		const other = parseAddress("So11111111111111111111111111111111111111112");
		expect(() =>
			checkMintMatches(requireApprovedToken("mainnet", USDC), details({ mint: other })),
		).toThrow(/different mint/);
	});
});
