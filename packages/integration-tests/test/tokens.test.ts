/**
 * The approved token list, held against the real chains.
 *
 * Every entry claims a mint and a number of decimals. If a claim is wrong, a machine trades the wrong
 * amount by a factor of a thousand, and no unit test can catch that because the truth only exists on
 * chain. So this reads mainnet and devnet directly.
 */

import {
	approvedTokens,
	type Cluster,
	cachedMints,
	checkMintMatches,
	parseAddress,
	requireApprovedToken,
	rpcAccountReader,
	solanaRpc,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";

/** Public endpoints are enough for reading a handful of accounts. Trading never uses them. */
const ENDPOINTS: Record<"mainnet" | "devnet", string> = {
	mainnet: process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com",
	devnet: process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com",
};

const lookupFor = (cluster: "mainnet" | "devnet") =>
	cachedMints(rpcAccountReader(solanaRpc(ENDPOINTS[cluster])));

/** Nothing has ever existed at this address: the hash of a phrase, not a key anyone holds. */
const EMPTY_ADDRESS = parseAddress("BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n");

describe.each(["mainnet", "devnet"] as const)("the approved tokens on %s", (cluster) => {
	const lookup = lookupFor(cluster);

	it("every entry exists on chain with the decimals the list claims", async () => {
		for (const approved of approvedTokens(cluster as Cluster)) {
			const details = await lookup(approved.mint);
			checkMintMatches(approved, details);
			expect(details.program).toBe("token");
		}
	});

	it("an address that is not a mint is refused rather than guessed at", async () => {
		// The system program: a real account, and not a token.
		await expect(lookup(parseAddress("11111111111111111111111111111111"))).rejects.toThrow(
			/not a token mint/,
		);
	});

	it("an address with nothing at it is reported as missing", async () => {
		await expect(lookup(EMPTY_ADDRESS)).rejects.toThrow(/no account exists/);
	});
});

describe("a real token nobody approved", () => {
	it("is read correctly and still refused", async () => {
		// Jupiter's own token: a real mainnet mint, deliberately left off the list.
		const jup = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
		const details = await lookupFor("mainnet")(parseAddress(jup));

		expect(details.decimals).toBe(6);
		expect(() => requireApprovedToken("mainnet", jup)).toThrow(/not approved/);
	});
});
