/**
 * A real transaction, built by the real router, taken apart before anyone signs it.
 *
 * Nothing is signed and nothing is sent. The wallet used is the devnet test wallet, which holds nothing
 * on mainnet, so the router's own simulation fails for lack of funds. That is useful rather than a
 * problem: it proves the default refuses a transaction that has already been shown not to work, and the
 * checks still run when that refusal is waived.
 *
 * Landing a real trade belongs to the signer path, against a local mainnet fork.
 */

import {
	checkUnsignedSwap,
	jupiterRouter,
	parseAddress,
	SWAP_PROGRAMS,
	type SwapQuote,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { live } from "./support/live.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
/** Public, and empty on mainnet. Nothing here can spend from it: no key is involved at any point. */
const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");

const key = process.env["JUPITER_API_KEY"];
const router = jupiterRouter({ ...(key ? { apiKey: key } : {}), timeoutMs: 20_000 });

const liveQuote = (): Promise<SwapQuote> =>
	live(() =>
		router.quote({
			inputMint: SOL,
			outputMint: USDC,
			amount: 10_000_000n as SwapQuote["inputAmount"],
			slippageBps: 50,
		}),
	);

describe("a transaction built from a live quote", () => {
	it("is refused by default when the router's own simulation failed", async () => {
		const quote = await liveQuote();

		await expect(router.build({ quote, wallet: WALLET })).rejects.toThrow(/simulation failed/);
	});

	it("is unsigned, pays from the machine's wallet, and calls only swap programs", async () => {
		const quote = await liveQuote();

		const swap = await live(() =>
			router.build({ quote, wallet: WALLET, allowFailedSimulation: true }),
		);

		expect(swap.facts.feePayer).toBe(WALLET);
		expect(swap.facts.signaturesRequired).toBe(1);
		expect(swap.facts.instructionCount).toBeGreaterThan(0);
		for (const program of swap.facts.programs) {
			expect(SWAP_PROGRAMS[program]).toBeDefined();
		}
		// Jupiter routes through lookup tables, which is how a swap fits in one transaction.
		expect(swap.facts.lookupTableCount).toBeGreaterThan(0);
		expect(swap.simulationError).toMatch(/debit|credit|insufficient/i);
	});

	it("comes back with an expiry and a fee that are real numbers", async () => {
		const quote = await liveQuote();

		const swap = await live(() =>
			router.build({ quote, wallet: WALLET, allowFailedSimulation: true }),
		);

		expect(swap.lastValidBlockHeight).toBeGreaterThan(0n);
		expect(swap.priorityFeeLamports).toBeGreaterThanOrEqual(0n);
		expect(swap.computeUnitLimit).toBeGreaterThan(0);
		expect(swap.quote).toBe(quote);
	});

	it("passes the same checks when taken apart on its own", async () => {
		const quote = await liveQuote();
		const swap = await live(() =>
			router.build({ quote, wallet: WALLET, allowFailedSimulation: true }),
		);

		expect(checkUnsignedSwap(swap.transaction, WALLET).feePayer).toBe(WALLET);
		// The same bytes, checked against a wallet they were not built for, are refused.
		expect(() =>
			checkUnsignedSwap(
				swap.transaction,
				parseAddress("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"),
			),
		).toThrow(/different wallet to sign/);
	});
});

describe("what a trade pays to be included", () => {
	it("is held to the cap by the router itself", async () => {
		const quote = await liveQuote();

		const swap = await live(() =>
			router.build({
				quote,
				wallet: WALLET,
				allowFailedSimulation: true,
				priorityFee: { maxLamports: 200_000n, level: "high" },
			}),
		);

		expect(swap.priorityFeeLamports).toBeDefined();
		expect(swap.priorityFeeLamports ?? 0n).toBeLessThanOrEqual(200_000n);
	});

	it("bids less when told to pay less", async () => {
		const quote = await liveQuote();

		const swap = await live(() =>
			router.build({
				quote,
				wallet: WALLET,
				allowFailedSimulation: true,
				priorityFee: { maxLamports: 5_000n, level: "medium" },
			}),
		);

		expect(swap.priorityFeeLamports ?? 0n).toBeLessThanOrEqual(5_000n);
	});
});
