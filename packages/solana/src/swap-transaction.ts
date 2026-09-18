/**
 * Turning a quote into a transaction, and checking what came back.
 *
 * A router builds the transaction, which means an outside service hands Maschina a set of instructions
 * and asks for a signature on them. That is the most dangerous moment in the whole system: a signature
 * is final, and nobody reads the bytes afterwards. So nothing here trusts the router.
 *
 * Every transaction is taken apart before it goes near the signer:
 *
 *   - it must be unsigned, and need exactly one signature, from the machine's own wallet
 *   - the machine's wallet must be the fee payer, so no one else's transaction is being paid for
 *   - every program it calls must be one we expect a swap to call
 *
 * Program ids cannot come from an address lookup table, they are always in the transaction's own list of
 * accounts, so checking that list is enough to know which programs will run.
 */

import { MaschinaError } from "@maschina/core";
import {
	getBase58Decoder,
	getCompiledTransactionMessageDecoder,
	getTransactionDecoder,
	type Address as KitAddress,
} from "@solana/kit";
import type { Address } from "./address.ts";
import { parseAddress } from "./address.ts";
import { checkFeeWithinCap, type PriorityFeeSettings } from "./priority-fee.ts";
import type { SwapQuote } from "./router.ts";

/**
 * The only programs a swap may call.
 *
 * Anything else means the transaction is doing something a swap does not do, and the run stops. The list
 * grows deliberately, one reviewed entry at a time, never because a transaction failed the check.
 */
export const SWAP_PROGRAMS: Record<string, string> = {
	ComputeBudget111111111111111111111111111111: "compute budget",
	"11111111111111111111111111111111": "system",
	TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "token",
	TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "token-2022",
	ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "associated token account",
	JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "jupiter aggregator",
	routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS: "raydium router",
};

/** What a transaction turned out to contain, once it was taken apart. */
export type TransactionFacts = {
	feePayer: Address;
	/** How many signatures it needs. A swap from one wallet needs exactly one. */
	signaturesRequired: number;
	/** Every program the transaction calls, by address. */
	programs: Address[];
	instructionCount: number;
	lookupTableCount: number;
};

/**
 * Takes a transaction apart and refuses it unless it is exactly what a swap from this wallet looks like.
 *
 * Returns what it found, so the facts can be recorded alongside the trade: what ran, and how much of it.
 */
export function checkUnsignedSwap(transaction: Uint8Array, wallet: Address): TransactionFacts {
	let decoded: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
	try {
		decoded = getTransactionDecoder().decode(transaction);
	} catch (cause) {
		throw new MaschinaError("invalid_input", "the router's transaction could not be read", {
			cause,
		});
	}

	const signatures = Object.entries(decoded.signatures);
	const signed = signatures.filter(([, signature]) => signature !== null);
	if (signed.length > 0) {
		// Something already signed this. Whatever it is, it is not a transaction we are about to author.
		throw new MaschinaError("invalid_input", "the router's transaction is already signed", {
			details: { signers: signed.map(([address]) => address) },
		});
	}
	if (signatures.length !== 1) {
		throw new MaschinaError("invalid_input", "a swap must need exactly one signature", {
			details: { signaturesRequired: signatures.length },
		});
	}

	const [signer] = signatures[0] ?? [];
	if (signer !== wallet) {
		throw new MaschinaError("forbidden", "the transaction asks a different wallet to sign", {
			details: { asked: signer, wallet },
		});
	}

	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) {
		// A transaction format Maschina cannot read is a transaction Maschina cannot check, and an
		// unreadable transaction is never signed.
		throw new MaschinaError(
			"invalid_input",
			"the transaction is in a format Maschina does not read",
			{
				details: { version: message.version },
			},
		);
	}
	const accounts = message.staticAccounts as readonly KitAddress[];

	const feePayer = accounts[0];
	if (feePayer !== wallet) {
		// The fee payer is the first account and always a signer. If it is not us, we would be paying for
		// somebody else's transaction, or they would be paying for ours.
		throw new MaschinaError(
			"forbidden",
			"the machine's wallet is not paying for this transaction",
			{
				details: { feePayer, wallet },
			},
		);
	}

	const programs: Address[] = [];
	for (const instruction of message.instructions) {
		const program = accounts[instruction.programAddressIndex];
		if (!program) {
			throw new MaschinaError("invalid_input", "the transaction calls a program it does not name");
		}
		if (!SWAP_PROGRAMS[program]) {
			throw new MaschinaError(
				"forbidden",
				"the transaction calls a program a swap should not call",
				{
					details: { program },
				},
			);
		}
		if (!programs.includes(program as Address)) programs.push(program as Address);
	}

	return {
		feePayer: parseAddress(feePayer),
		signaturesRequired: signatures.length,
		programs,
		instructionCount: message.instructions.length,
		lookupTableCount:
			"addressTableLookups" in message ? (message.addressTableLookups?.length ?? 0) : 0,
	};
}

export type BuildSwapRequest = {
	quote: SwapQuote;
	/** The machine's wallet: the only account that may sign, and the one that pays. */
	wallet: Address;
	/**
	 * What this trade may pay to be included quickly. A router is asked to respect the cap, and its
	 * answer is checked against it before anything is signed.
	 */
	priorityFee?: PriorityFeeSettings;
	/**
	 * Whether to accept a transaction the router's own simulation says will fail. Off by default:
	 * sending a transaction that already failed is paying a fee to be told so again.
	 */
	allowFailedSimulation?: boolean;
};

export type UnsignedSwap = {
	router: string;
	wallet: Address;
	quote: SwapQuote;
	/** The transaction as wire bytes, unsigned. Only the signer ever signs it. */
	transaction: Uint8Array;
	/** The block height after which this transaction can never land, so a stale one is never resent. */
	lastValidBlockHeight: bigint;
	/** What the router said it is paying to be included. Absent when the router does not say. */
	priorityFeeLamports?: bigint;
	/** The compute budget the router asked for. Absent when the router does not say. */
	computeUnitLimit?: number;
	facts: TransactionFacts;
	/** What the router's own simulation said, kept for the record whether it passed or failed. */
	simulationError?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const wholeNumber = (value: unknown, field: string): bigint => {
	if (typeof value === "number" && Number.isInteger(value) && value >= 0) return BigInt(value);
	if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
	throw new MaschinaError("invalid_input", `the router's ${field} is not a whole number`, {
		details: { [field]: value },
	});
};

/** Reads what a router returned when asked to build a swap. */
export function parseBuiltSwap(request: BuildSwapRequest, body: unknown): UnsignedSwap {
	const built = asRecord(body);
	if (!built) throw new MaschinaError("invalid_input", "the router did not return a transaction");

	const encoded = built["swapTransaction"];
	if (typeof encoded !== "string" || encoded.length === 0) {
		throw new MaschinaError("invalid_input", "the router did not return a transaction");
	}

	let transaction: Uint8Array;
	try {
		transaction = Uint8Array.from(Buffer.from(encoded, "base64"));
	} catch (cause) {
		throw new MaschinaError("invalid_input", "the router's transaction is not readable", { cause });
	}

	const simulation = asRecord(built["simulationError"]);
	const simulationError =
		simulation === undefined ? undefined : String(simulation["error"] ?? "simulation failed");
	if (simulationError && !request.allowFailedSimulation) {
		throw new MaschinaError(
			"invalid_input",
			`the router's own simulation failed: ${simulationError}`,
		);
	}

	const facts = checkUnsignedSwap(transaction, request.wallet);

	// A router that does not state its fee or compute budget leaves these out rather than claiming zero.
	const fee = built["prioritizationFeeLamports"];
	const limit = built["computeUnitLimit"];

	// Routers are asked for a capped fee and mostly respect it. "Mostly" is not a basis for spending
	// money, so the answer is held to the cap before the transaction goes anywhere near a signer.
	if (request.priorityFee && fee !== undefined) {
		checkFeeWithinCap(wholeNumber(fee, "priority fee"), request.priorityFee);
	}

	return {
		router: request.quote.router,
		wallet: request.wallet,
		quote: request.quote,
		transaction,
		lastValidBlockHeight: wholeNumber(built["lastValidBlockHeight"], "last valid block height"),
		...(fee === undefined ? {} : { priorityFeeLamports: wholeNumber(fee, "priority fee") }),
		...(limit === undefined
			? {}
			: { computeUnitLimit: Number(wholeNumber(limit, "compute unit limit")) }),
		facts,
		...(simulationError ? { simulationError } : {}),
	};
}

/**
 * The signature of a signed transaction.
 *
 * A transaction's signature is its identity on chain: it is decided the moment it is signed, before it
 * is sent anywhere, which is what makes it possible to write down what is about to happen and then ask
 * the chain about it afterwards. Reading it here rather than waiting for the chain to hand it back is
 * the difference between a crash that can be recovered and one that cannot.
 */
export function signatureOf(signedTransaction: Uint8Array): string {
	let decoded: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
	try {
		decoded = getTransactionDecoder().decode(signedTransaction);
	} catch (cause) {
		throw new MaschinaError("invalid_input", "this is not a transaction", { cause });
	}

	const [first] = Object.values(decoded.signatures);
	if (!first) {
		throw new MaschinaError("invalid_input", "this transaction has no signature on it");
	}
	return getBase58Decoder().decode(first);
}
