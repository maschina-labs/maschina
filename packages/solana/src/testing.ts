/**
 * Building transactions for tests.
 *
 * The signer, the orchestrator and the daemon all need to test against transactions they did not
 * receive from a real router: one that pays from the wrong wallet, one that calls a program it should
 * not, one that is simply nonsense. Building those by hand needs a Solana library, and Solana libraries
 * live only in this package, so the helper lives here and everything else asks for it.
 *
 * Nothing here is used in production. It builds unsigned transactions and nothing else: it holds no key
 * and cannot sign.
 */

import {
	appendTransactionMessageInstruction,
	type Blockhash,
	compileTransaction,
	createTransactionMessage,
	getTransactionEncoder,
	type Address as KitAddress,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import type { Address } from "./address.ts";

export type FakeTransaction = {
	/** Who pays and signs. Defaults to the wallet given. */
	feePayer?: Address | string;
	/** The programs it calls, in order. Defaults to a compute budget instruction and a swap. */
	programs?: string[];
	blockhash?: string;
	lastValidBlockHeight?: bigint;
};

const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

/** An unsigned transaction, built to whatever shape a test needs. */
export function unsignedTransactionFor(wallet: Address | string, options: FakeTransaction = {}) {
	const programs = options.programs ?? [COMPUTE_BUDGET, JUPITER];
	const lifetime = {
		blockhash: (options.blockhash ?? "11111111111111111111111111111111") as Blockhash,
		lastValidBlockHeight: options.lastValidBlockHeight ?? 426_070_577n,
	};

	// The library tracks a transaction's size in its type, which changes with every instruction added.
	// A loop cannot express that, so the draft is held at the shape these two functions accept.
	type Draft = Parameters<typeof appendTransactionMessageInstruction>[1];
	type Compilable = Parameters<typeof compileTransaction>[0];

	let message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer((options.feePayer ?? wallet) as KitAddress, draft),
		(draft) => setTransactionMessageLifetimeUsingBlockhash(lifetime, draft),
	) as Draft;

	for (const program of programs) {
		message = appendTransactionMessageInstruction(
			{ programAddress: program as KitAddress },
			message,
		) as Draft;
	}

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message as Compilable)));
}

/** The same transaction, base64 encoded, which is how a router would hand it over. */
export const unsignedTransactionBase64 = (
	wallet: Address | string,
	options: FakeTransaction = {},
): string => Buffer.from(unsignedTransactionFor(wallet, options)).toString("base64");
