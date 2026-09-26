/**
 * The wallet in the browser.
 *
 * Phantom, Solflare and the rest inject the same small object, so this asks that object directly rather
 * than carrying a wallet library. Two reasons: the app never touches a chain, and a signing flow this
 * short is easier to read than a dependency that hides it.
 *
 * Nothing here approves a transaction. The only thing it ever signs is a sentence.
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
};

declare global {
	interface Window {
		solana?: Injected;
		phantom?: { solana?: Injected };
	}
}

export class NoWallet extends Error {
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

/** True when there is a wallet to talk to at all, so the button can say the right thing. */
export const hasWallet = (): boolean => Boolean(window.phantom?.solana ?? window.solana);

/** Asks the wallet to connect, and returns the address it offers. */
export async function connect(): Promise<string> {
	const { publicKey } = await injected().connect();
	return publicKey.toString();
}

/** The address of an already connected wallet, without prompting for one. */
export async function reconnect(): Promise<string | undefined> {
	if (!hasWallet()) return undefined;
	try {
		const { publicKey } = await injected().connect({ onlyIfTrusted: true });
		return publicKey.toString();
	} catch {
		// Not trusted yet, which is not an error: it just means the person has to press the button.
		return undefined;
	}
}

/** Signs a sentence and returns the signature as base58, which is what the API expects. */
export async function signMessage(message: string): Promise<string> {
	const signed = await injected().signMessage(new TextEncoder().encode(message), "utf8");
	const signature = signed instanceof Uint8Array ? signed : signed.signature;
	return encodeBase58(signature);
}
