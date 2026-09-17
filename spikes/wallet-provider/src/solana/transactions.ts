/**
 * Unsigned devnet transactions for the policy checks. The machine wallet pays the fee and is the only
 * signer, and Turnkey signs for it, so each builder returns the unsigned transaction as hex, the format
 * Turnkey's signing endpoint takes.
 */

import {
	type Address,
	address,
	appendTransactionMessageInstructions,
	compileTransaction,
	createNoopSigner,
	createTransactionMessage,
	getTransactionEncoder,
	type Instruction,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getAddMemoInstruction, MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";
import { getTransferSolInstruction } from "@solana-program/system";
import {
	findAssociatedTokenPda,
	getCreateAssociatedTokenIdempotentInstruction,
	getSyncNativeInstruction,
	getTransferCheckedInstruction,
	TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

export const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");
/** A program the machine wallet policy doesn't allow. The refusal check only needs one to call. */
export const MEMO_PROGRAM: string = MEMO_PROGRAM_ADDRESS;

export type Blockhash = Parameters<typeof setTransactionMessageLifetimeUsingBlockhash>[0];

async function unsignedHex(
	payer: Address,
	blockhash: Blockhash,
	instructions: Instruction[],
): Promise<string> {
	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(m) => setTransactionMessageFeePayer(payer, m),
		(m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
		(m) => appendTransactionMessageInstructions(instructions, m),
	);
	const bytes = getTransactionEncoder().encode(compileTransaction(message));
	return Buffer.from(bytes).toString("hex");
}

/** The wallet's own wrapped SOL account. */
export async function wrappedSolAccount(wallet: Address): Promise<Address> {
	const [account] = await findAssociatedTokenPda({
		owner: wallet,
		mint: WRAPPED_SOL,
		tokenProgram: TOKEN_PROGRAM_ADDRESS,
	});
	return account;
}

export async function transferSol(options: {
	from: Address;
	to: Address;
	lamports: bigint;
	blockhash: Blockhash;
}): Promise<string> {
	const source = createNoopSigner(options.from);
	return unsignedHex(options.from, options.blockhash, [
		getTransferSolInstruction({ source, destination: options.to, amount: options.lamports }),
	]);
}

export async function memoOnly(options: {
	payer: Address;
	text: string;
	blockhash: Blockhash;
}): Promise<string> {
	return unsignedHex(options.payer, options.blockhash, [
		getAddMemoInstruction({ memo: options.text }),
	]);
}

/**
 * Sends a token to the owner as a checked transfer, which is the only kind whose mint the policy can
 * see. With `wrap`, it first wraps that much of the wallet's SOL into its own wrapped SOL account.
 */
export async function tokenTransfer(options: {
	wallet: Address;
	owner: Address;
	mint: Address;
	amount: bigint;
	blockhash: Blockhash;
	wrap?: boolean;
	decimals?: number;
	/**
	 * Crossmint counts the account created here as a recipient and pays its rent, so its checks send only
	 * to token accounts that already exist.
	 */
	createDestination?: boolean;
}): Promise<string> {
	const payer = createNoopSigner(options.wallet);
	const tokenProgram = TOKEN_PROGRAM_ADDRESS;
	const [source] = await findAssociatedTokenPda({
		owner: options.wallet,
		mint: options.mint,
		tokenProgram,
	});
	const [destination] = await findAssociatedTokenPda({
		owner: options.owner,
		mint: options.mint,
		tokenProgram,
	});

	const wrap = options.wrap ?? true;
	const instructions: Instruction[] = [];
	if (wrap) {
		instructions.push(
			getCreateAssociatedTokenIdempotentInstruction({
				payer,
				owner: options.wallet,
				mint: options.mint,
				ata: source,
			}),
			getTransferSolInstruction({ source: payer, destination: source, amount: options.amount }),
			getSyncNativeInstruction({ account: source }),
		);
	}
	if (options.createDestination ?? true) {
		instructions.push(
			getCreateAssociatedTokenIdempotentInstruction({
				payer,
				owner: options.owner,
				mint: options.mint,
				ata: destination,
			}),
		);
	}
	instructions.push(
		getTransferCheckedInstruction({
			source,
			mint: options.mint,
			destination,
			authority: payer,
			amount: options.amount,
			decimals: options.decimals ?? 9,
		}),
	);
	return unsignedHex(options.wallet, options.blockhash, instructions);
}

/**
 * Creates another wallet's associated token account, paid for by `payer`. The policy allows it: the
 * only program called is the associated token program, and there is no top-level transfer.
 */
export async function createTokenAccountFor(options: {
	payer: Address;
	owner: Address;
	mint: Address;
	blockhash: Blockhash;
}): Promise<string> {
	const [ata] = await findAssociatedTokenPda({
		owner: options.owner,
		mint: options.mint,
		tokenProgram: TOKEN_PROGRAM_ADDRESS,
	});
	return unsignedHex(options.payer, options.blockhash, [
		getCreateAssociatedTokenIdempotentInstruction({
			payer: createNoopSigner(options.payer),
			owner: options.owner,
			mint: options.mint,
			ata,
		}),
	]);
}
