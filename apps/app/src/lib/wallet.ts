/**
 * The wallets in the browser, found through the Wallet Standard.
 *
 * Every modern Solana wallet (Solflare, Jupiter, Backpack, Phantom, Glow and the rest) announces itself
 * with the same two browser events and offers the same small set of features, so the app lists whatever
 * is installed rather than guessing at one. Nothing is ever chosen for the owner: they pick a wallet each
 * time, or mark one as their default, which is listed first. The standard is a few events and objects,
 * so it is spoken directly here rather than through a wallet library.
 *
 * It signs two things: a sentence, to sign in, and a transaction the owner approves in their own wallet
 * to fund one of their machines. Nothing here approves anything by itself.
 */

import { encodeBase58 } from "@maschina/auth";
import { useSyncExternalStore } from "react";

type Account = { address: string };

export type StandardWallet = {
	name: string;
	/** A data: URI the wallet supplies for itself: its own mark, as it chooses to look. */
	icon: string;
	chains: readonly string[];
	features: Record<string, unknown>;
};

type Connect = {
	connect(input?: { silent?: boolean }): Promise<{ accounts: readonly Account[] }>;
};
type SignMessage = {
	signMessage(
		...input: { account: Account; message: Uint8Array }[]
	): Promise<{ signature: Uint8Array }[]>;
};
type SignAndSend = {
	signAndSendTransaction(
		...input: { account: Account; transaction: Uint8Array; chain: string }[]
	): Promise<{ signature: Uint8Array }[]>;
};

const CHAIN = "solana:mainnet";
const DEFAULT_KEY = "maschina.wallet.default";
const ACTIVE_KEY = "maschina.wallet.active";

// What the browser has announced, kept as it arrives.
const found = new Map<string, StandardWallet>();
let listed: StandardWallet[] = [];
const watchers = new Set<() => void>();
const changed = () => {
	listed = [...found.values()];
	for (const watch of watchers) watch();
};

/** A Solana wallet that can connect and sign a message: anything less cannot sign anyone in. */
const usable = (wallet: StandardWallet) =>
	wallet.chains.some((chain) => chain.startsWith("solana:")) &&
	"standard:connect" in wallet.features &&
	"solana:signMessage" in wallet.features;

function register(...wallets: StandardWallet[]) {
	for (const wallet of wallets) if (usable(wallet)) found.set(wallet.name, wallet);
	changed();
	return () => {
		for (const wallet of wallets) found.delete(wallet.name);
		changed();
	};
}

let listening = false;
/** Starts listening for wallets, and tells any already loaded that the app is here. Safe to call twice. */
export function discoverWallets() {
	if (listening || typeof window === "undefined") return;
	listening = true;
	const api = { register };
	window.addEventListener("wallet-standard:register-wallet", (event) => {
		const callback = (event as CustomEvent<(api: { register: typeof register }) => void>).detail;
		callback?.(api);
	});
	window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
}

/** The wallets installed, the owner's default first, then by name. */
export function useWallets(): StandardWallet[] {
	discoverWallets();
	const all = useSyncExternalStore(
		(watch) => {
			watchers.add(watch);
			return () => watchers.delete(watch);
		},
		() => listed,
		() => listed,
	);
	const chosen = defaultWallet();
	return [...all].sort((a, b) =>
		a.name === chosen ? -1 : b.name === chosen ? 1 : a.name.localeCompare(b.name),
	);
}

const read = (key: string) => {
	try {
		return localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
};
const write = (key: string, value: string | undefined) => {
	try {
		if (value === undefined) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {}
};

/** The wallet the owner chose as their default, if they ever did. Nothing is assumed otherwise. */
export const defaultWallet = () => read(DEFAULT_KEY);
export function setDefaultWallet(name: string | undefined) {
	write(DEFAULT_KEY, name);
	changed();
}

// The wallet picker: asked for a wallet, it waits for the owner to choose one or to close it.
type Asking = { resolve(name: string): void; reject(error: Error): void };
let asking: Asking | undefined;
const pickers = new Set<() => void>();
const pickerChanged = () => {
	for (const watch of pickers) watch();
};

class NoWalletChosen extends Error {
	constructor() {
		super("No wallet was chosen.");
		this.name = "NoWalletChosen";
	}
}

/** Shows the picker, and resolves with the wallet the owner chooses. */
export function pickWallet(): Promise<string> {
	discoverWallets();
	asking?.reject(new NoWalletChosen());
	return new Promise((resolve, reject) => {
		asking = { resolve, reject };
		pickerChanged();
	});
}

export function choose(name: string) {
	const was = asking;
	asking = undefined;
	pickerChanged();
	was?.resolve(name);
}

export function dismissPicker() {
	const was = asking;
	asking = undefined;
	pickerChanged();
	was?.reject(new NoWalletChosen());
}

/** Whether the picker is waiting on the owner, for code that is not a component. */
export const isPicking = () => asking !== undefined;

export function usePickerOpen(): boolean {
	return useSyncExternalStore(
		(watch) => {
			pickers.add(watch);
			return () => pickers.delete(watch);
		},
		() => asking !== undefined,
		() => false,
	);
}

// The wallet signed in with, and the account it gave.
let active: { wallet: StandardWallet; account: Account } | undefined;

function feature<T>(wallet: StandardWallet, name: string): T {
	const offered = wallet.features[name] as T | undefined;
	if (!offered) throw new Error(`${wallet.name} cannot do that from here.`);
	return offered;
}

async function connectTo(wallet: StandardWallet, silent = false): Promise<Account> {
	const { accounts } = await feature<Connect>(wallet, "standard:connect").connect(
		silent ? { silent } : undefined,
	);
	const account = accounts[0];
	if (!account) throw new Error(`${wallet.name} did not offer an account.`);
	active = { wallet, account };
	write(ACTIVE_KEY, wallet.name);
	return account;
}

/** Asks the owner which wallet, connects it, and returns the address it offers. */
export async function connect(): Promise<string> {
	const name = await pickWallet();
	const wallet = found.get(name);
	if (!wallet) throw new Error(`${name} is no longer installed.`);
	return (await connectTo(wallet)).address;
}

/** The wallet signed in with, connecting it again quietly after a reload if it allows that. */
async function current(): Promise<{ wallet: StandardWallet; account: Account }> {
	if (active) return active;
	discoverWallets();
	const name = read(ACTIVE_KEY);
	const wallet = name ? found.get(name) : undefined;
	if (!wallet) throw new Error("Connect your wallet first.");
	await connectTo(wallet, true);
	if (!active) throw new Error("Connect your wallet first.");
	return active;
}

/** Signs a sentence and returns the signature as base58, which is what the API expects. */
export async function signMessage(message: string): Promise<string> {
	const { wallet, account } = await current();
	const [signed] = await feature<SignMessage>(wallet, "solana:signMessage").signMessage({
		account,
		message: new TextEncoder().encode(message),
	});
	if (!signed) throw new Error(`${wallet.name} did not sign.`);
	return encodeBase58(signed.signature);
}

/**
 * Asks the wallet to approve and send a transaction, given as base64, and returns its signature. The
 * wallet shows the owner what it does first; nothing moves unless they approve.
 */
export async function sendTransaction(base64: string): Promise<string> {
	const { wallet, account } = await current();
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	const [sent] = await feature<SignAndSend>(
		wallet,
		"solana:signAndSendTransaction",
	).signAndSendTransaction({ account, transaction: bytes, chain: CHAIN });
	if (!sent) throw new Error(`${wallet.name} did not send it.`);
	return encodeBase58(sent.signature);
}

/** Forgets which wallet was signed in with, for signing out. */
export function forgetActiveWallet() {
	active = undefined;
	write(ACTIVE_KEY, undefined);
}
