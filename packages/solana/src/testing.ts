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
	generateKeyPair,
	getAddressFromPublicKey,
	getBase58Decoder,
	getTransactionEncoder,
	type Address as KitAddress,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
	signBytes,
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

/**
 * A wallet that can sign, for tests of anything that checks a signature.
 *
 * Every service that verifies a signed sentence needs a real keypair to test against, because a made up
 * signature proves nothing about the code that checks it. Solana libraries live only in this package,
 * so the keypair is made here and everything else asks for one.
 */
export async function testWallet(): Promise<{
	address: string;
	sign(message: string): Promise<string>;
}> {
	const keys = await generateKeyPair();
	const address = await getAddressFromPublicKey(keys.publicKey);
	return {
		address,
		sign: async (message: string) => {
			const signature = await signBytes(keys.privateKey, new TextEncoder().encode(message));
			return getBase58Decoder().decode(signature);
		},
	};
}

/** What a transaction asks to pay for priority, for tests that check it is held to a cap. */
export type ComputeBudgetOptions = {
	microLamportsPerUnit?: bigint;
	computeUnitLimit?: number;
};

/**
 * A transaction carrying compute budget instructions, built by hand.
 *
 * The instruction data is a discriminator and a little-endian number, which is the whole format. Built
 * here rather than with a program library so the decoder is tested against bytes somebody else laid out
 * from the specification, not against the same code that reads them.
 */
export function computeBudgetTransaction(
	wallet: Address | string,
	options: ComputeBudgetOptions,
): Uint8Array {
	type Draft = Parameters<typeof appendTransactionMessageInstruction>[1];
	type Compilable = Parameters<typeof compileTransaction>[0];

	let message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(wallet as KitAddress, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: "11111111111111111111111111111111" as Blockhash,
					lastValidBlockHeight: 426_070_577n,
				},
				draft,
			),
	) as Draft;

	const compute = "ComputeBudget111111111111111111111111111111" as KitAddress;

	if (options.computeUnitLimit !== undefined) {
		const data = new Uint8Array(5);
		data[0] = 2;
		new DataView(data.buffer).setUint32(1, options.computeUnitLimit, true);
		message = appendTransactionMessageInstruction(
			{ programAddress: compute, data },
			message,
		) as Draft;
	}
	if (options.microLamportsPerUnit !== undefined) {
		const data = new Uint8Array(9);
		data[0] = 3;
		new DataView(data.buffer).setBigUint64(1, options.microLamportsPerUnit, true);
		message = appendTransactionMessageInstruction(
			{ programAddress: compute, data },
			message,
		) as Draft;
	}

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message as Compilable)));
}
