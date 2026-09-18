/**
 * Confirmation against the real chain.
 *
 * Two paths matter and both are proved here: waiting on a transaction that landed, and asking about one
 * that never did. The signature that never landed is a well-formed signature the chain has never seen,
 * which is exactly what a run that crashed before sending would leave behind.
 */

import {
	type ConfirmationReader,
	confirmSignature,
	didItLand,
	rpcConfirmationReader,
	solanaRpc,
} from "@maschina/solana";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const DEVNET = process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com";
const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

/** A signature of the right shape that no chain has ever seen, and never will. */
const NEVER_SENT =
	"5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

const reader: ConfirmationReader = rpcConfirmationReader(solanaRpc(DEVNET));

/** The public endpoint rate limits hard, so the tests go at a pace it tolerates. */
afterEach(() => new Promise((resolve) => setTimeout(resolve, 1000)));

/** A real signature from the test wallet's own history, whatever it happens to be today. */
let landedSignature: string;

beforeAll(async () => {
	const response = await fetch(DEVNET, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "getSignaturesForAddress",
			params: [WALLET, { limit: 1 }],
		}),
	});
	const body = (await response.json()) as { result: { signature: string; err: unknown }[] };
	const first = body.result[0];
	if (!first) throw new Error("the devnet test wallet has no transaction history to check against");
	landedSignature = first.signature;
});

describe("a transaction that landed", () => {
	it("is found when the chain is asked about it after the fact", async () => {
		const result = await didItLand(reader, landedSignature);

		expect(result.outcome).toBe("landed");
		expect(result).toMatchObject({ signature: landedSignature });
	});

	it("is still found by the waiting path, long after its blockhash expired", async () => {
		// The height is deliberately ancient, so the only way to the right answer is the history search
		// that runs before anything is called expired.
		const result = await confirmSignature(
			reader,
			{ signature: landedSignature, lastValidBlockHeight: 1n },
			{ pollMs: 1500, timeoutMs: 20_000 },
		);

		expect(result.outcome).toBe("landed");
	});
});

describe("a transaction that never landed", () => {
	it("is reported as expired once it can never land", async () => {
		const result = await confirmSignature(
			reader,
			{ signature: NEVER_SENT, lastValidBlockHeight: 1n },
			{ pollMs: 1500, timeoutMs: 20_000 },
		);

		expect(result.outcome).toBe("expired");
	});

	it("is unknown, never 'did not happen', while it could still land", async () => {
		const height = await reader.blockHeight();

		const result = await confirmSignature(
			reader,
			{ signature: NEVER_SENT, lastValidBlockHeight: height + 1000n },
			{ pollMs: 1500, timeoutMs: 1500 },
		);

		expect(result.outcome).toBe("unknown");
	});

	it("is unknown to the recovery path when there is no expiry to judge against", async () => {
		expect(await didItLand(reader, NEVER_SENT)).toMatchObject({ outcome: "unknown" });
	});

	it("is expired to the recovery path once the expiry has passed", async () => {
		expect(await didItLand(reader, NEVER_SENT, 1n)).toMatchObject({ outcome: "expired" });
	});
});

describe("the chain's own numbers", () => {
	it("reports a block height that moves forward", async () => {
		const first = await reader.blockHeight();
		expect(first).toBeGreaterThan(0n);

		const second = await reader.blockHeight();
		expect(second).toBeGreaterThanOrEqual(first);
	});
});
