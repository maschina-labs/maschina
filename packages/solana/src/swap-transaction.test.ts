import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import type { SwapQuote } from "./router.ts";
import { checkUnsignedSwap, parseBuiltSwap, SWAP_PROGRAMS } from "./swap-transaction.ts";
import { unsignedTransactionBase64, unsignedTransactionFor } from "./testing.ts";

const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const SOMEONE_ELSE = parseAddress("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");
const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
/** A real program, and not one a swap has any business calling. */
const AN_UNEXPECTED_PROGRAM = "Stake11111111111111111111111111111111111111";

/** Builds an unsigned transaction with whatever fee payer and programs the test wants. */
const transactionBytes = (options: { feePayer?: string; programs?: string[] } = {}) =>
	unsignedTransactionFor(WALLET, options);

const quote = (): SwapQuote => ({
	router: "jupiter",
	inputMint: SOL,
	outputMint: USDC,
	inputAmount: 10_000_000n as SwapQuote["inputAmount"],
	outputAmount: 1_058_797n as SwapQuote["outputAmount"],
	minimumOutputAmount: 1_053_503n as SwapQuote["minimumOutputAmount"],
	slippageBps: 50,
	priceImpactBps: 1,
	route: [],
	raw: { quote: "as it arrived" },
});

const built = (over: Record<string, unknown> = {}) => ({
	swapTransaction: unsignedTransactionBase64(WALLET),
	lastValidBlockHeight: 426_070_577,
	prioritizationFeeLamports: 6417,
	computeUnitLimit: 1_400_000,
	...over,
});

describe("taking a router's transaction apart", () => {
	it("accepts a swap that only this wallet signs and pays for", () => {
		const facts = checkUnsignedSwap(transactionBytes(), WALLET);

		expect(facts.feePayer).toBe(WALLET);
		expect(facts.signaturesRequired).toBe(1);
		expect(facts.programs).toEqual([COMPUTE_BUDGET, JUPITER]);
		expect(facts.instructionCount).toBe(2);
	});

	it("names each program only once, however many instructions call it", () => {
		const facts = checkUnsignedSwap(
			transactionBytes({ programs: [COMPUTE_BUDGET, COMPUTE_BUDGET, JUPITER] }),
			WALLET,
		);

		expect(facts.programs).toEqual([COMPUTE_BUDGET, JUPITER]);
		expect(facts.instructionCount).toBe(3);
	});

	it("refuses a transaction that asks another wallet to sign", () => {
		expect(() => checkUnsignedSwap(transactionBytes({ feePayer: SOMEONE_ELSE }), WALLET)).toThrow(
			/different wallet to sign/,
		);
	});

	it("refuses a program a swap has no reason to call", () => {
		expect(() =>
			checkUnsignedSwap(transactionBytes({ programs: [JUPITER, AN_UNEXPECTED_PROGRAM] }), WALLET),
		).toThrow(/should not call/);
	});

	it("refuses bytes that are not a transaction", () => {
		expect(() => checkUnsignedSwap(new Uint8Array([1, 2, 3]), WALLET)).toThrow(MaschinaError);
	});

	it("knows which programs a swap may call, and says what each one is", () => {
		expect(SWAP_PROGRAMS[JUPITER]).toBe("jupiter aggregator");
		expect(SWAP_PROGRAMS[AN_UNEXPECTED_PROGRAM]).toBeUndefined();
	});
});

describe("reading what a router built", () => {
	it("keeps the transaction, the fee and the height it expires at", () => {
		const swap = parseBuiltSwap({ quote: quote(), wallet: WALLET }, built());

		expect(swap.wallet).toBe(WALLET);
		expect(swap.router).toBe("jupiter");
		expect(swap.lastValidBlockHeight).toBe(426_070_577n);
		expect(swap.priorityFeeLamports).toBe(6417n);
		expect(swap.computeUnitLimit).toBe(1_400_000);
		expect(swap.facts.feePayer).toBe(WALLET);
		expect(swap.simulationError).toBeUndefined();
	});

	it("keeps the quote it was built from, so the record can show both", () => {
		const original = quote();
		const swap = parseBuiltSwap({ quote: original, wallet: WALLET }, built());

		expect(swap.quote).toBe(original);
	});

	it("refuses a transaction the router's own simulation says will fail", () => {
		expect(() =>
			parseBuiltSwap(
				{ quote: quote(), wallet: WALLET },
				built({ simulationError: { errorCode: "TRANSACTION_ERROR", error: "no prior credit" } }),
			),
		).toThrow(/simulation failed: no prior credit/);
	});

	it("can be told to accept a failed simulation, and says so afterwards", () => {
		const swap = parseBuiltSwap(
			{ quote: quote(), wallet: WALLET, allowFailedSimulation: true },
			built({ simulationError: { error: "no prior credit" } }),
		);

		expect(swap.simulationError).toBe("no prior credit");
	});

	it("still checks the transaction even when a failed simulation is allowed", () => {
		expect(() =>
			parseBuiltSwap(
				{ quote: quote(), wallet: WALLET, allowFailedSimulation: true },
				built({
					swapTransaction: unsignedTransactionBase64(WALLET, { feePayer: SOMEONE_ELSE }),
					simulationError: { error: "no prior credit" },
				}),
			),
		).toThrow(/different wallet to sign/);
	});

	it.each([
		["an answer that is not an object", "nope"],
		["no transaction at all", { swapTransaction: undefined }],
		["an empty transaction", { swapTransaction: "" }],
		["a missing expiry height", { lastValidBlockHeight: undefined }],
		["an expiry height that is text but not a number", { lastValidBlockHeight: "soon" }],
		["an expiry height that is not whole", { lastValidBlockHeight: 1.5 }],
		["a fee that is not a number", { prioritizationFeeLamports: "many" }],
		["a negative fee", { prioritizationFeeLamports: -1 }],
		["a compute limit that is not a number", { computeUnitLimit: "lots" }],
	])("refuses %s", (_name, over) => {
		const body = typeof over === "string" ? over : built(over as Record<string, unknown>);
		expect(() => parseBuiltSwap({ quote: quote(), wallet: WALLET }, body)).toThrow(MaschinaError);
	});

	it("leaves out a fee or a compute budget the router never stated", () => {
		const swap = parseBuiltSwap(
			{ quote: quote(), wallet: WALLET },
			built({ prioritizationFeeLamports: undefined, computeUnitLimit: undefined }),
		);

		expect(swap.priorityFeeLamports).toBeUndefined();
		expect(swap.computeUnitLimit).toBeUndefined();
		expect(swap.lastValidBlockHeight).toBe(426_070_577n);
	});

	it("reads whole numbers whether they arrive as numbers or as text", () => {
		const swap = parseBuiltSwap(
			{ quote: quote(), wallet: WALLET },
			built({ lastValidBlockHeight: "426070577", prioritizationFeeLamports: "6417" }),
		);

		expect(swap.lastValidBlockHeight).toBe(426_070_577n);
		expect(swap.priorityFeeLamports).toBe(6417n);
	});
});
