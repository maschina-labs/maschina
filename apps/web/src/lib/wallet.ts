/**
 * The wallet in the browser.
 *
 * Phantom, Solflare and the rest inject the same small object, so this asks that object directly rather
 * than carrying a wallet library. Two reasons: the app never touches a chain, and a signing flow this
 * short is easier to read than a dependency that hides it.
 *
 * It signs two things: a sentence, to sign in, and a transaction the owner approves in their own wallet
 * to fund one of their machines. Nothing here approves anything by itself.
 */

import { encodeBase58 } from "@maschina/auth";

type Injected = {
	isPhantom?: boolean;
	publicKey?: { toString(): string } | null;
	connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
	disconnect?(): Promise<void>;
	signMessage(
		message: Uint8Array,
		encoding?: string,
	): Promise<{ signature: Uint8Array } | Uint8Array>;
	/** Phantom's request interface, which takes a serialised transaction as base58. */
	request?(call: { method: string; params: unknown }): Promise<{ signature: string }>;
};

declare global {
	interface Window {
		solana?: Injected;
		phantom?: { solana?: Injected };
	}
}

class NoWallet extends Error {
	constructor() {
		super("No Solana wallet found in this browser.");
		this.name = "NoWallet";
	}
}

function injected(): Injected {
	const wallet = window.phantom?.solana ?? window.solana;
	if (!wallet) throw new NoWallet();
	return wallet;
}

/** Asks the wallet to connect, and returns the address it offers. */
export async function connect(): Promise<string> {
	const { publicKey } = await injected().connect();
	return publicKey.toString();
}

/** Signs a sentence and returns the signature as base58, which is what the API expects. */
export async function signMessage(message: string): Promise<string> {
	const signed = await injected().signMessage(new TextEncoder().encode(message), "utf8");
	const signature = signed instanceof Uint8Array ? signed : signed.signature;
	return encodeBase58(signature);
}

/**
 * Asks the wallet to approve and send a transaction, given as base64, and returns its signature. The
 * wallet shows the owner what it does first; nothing moves unless they approve.
 */
export async function sendTransaction(base64: string): Promise<string> {
	const wallet = injected();
	if (!wallet.request)
		throw new Error("This wallet cannot send transactions from here. Try Phantom.");
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	const sent = await wallet.request({
		method: "signAndSendTransaction",
		params: { message: encodeBase58(bytes) },
	});
	return sent.signature;
}
