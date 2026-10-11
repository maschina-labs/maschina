/**
 * The wallets this browser has signed in with, newest first, so switching back is one press.
 *
 * Only public addresses are kept, and only here: they prove nothing and sign nothing. The wallet app
 * still decides which account connects; this list is a memory, never an authority.
 */

import { useSyncExternalStore } from "react";

const KEY = "maschina.wallets";
const CHANGED = "maschina:wallets";
const KEPT = 6;

export type KnownWallet = { address: string; lastUsed: string };

function read(): KnownWallet[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
		return Array.isArray(parsed)
			? parsed.filter(
					(each): each is KnownWallet =>
						typeof each?.address === "string" && typeof each?.lastUsed === "string",
				)
			: [];
	} catch {
		return [];
	}
}

let cache = read();
let cacheRaw: string | null = null;

function snapshot(): KnownWallet[] {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(KEY);
	} catch {}
	if (raw !== cacheRaw) {
		cacheRaw = raw;
		cache = read();
	}
	return cache;
}

/** Remembers a wallet as just used, keeping the newest few. */
export function rememberWallet(address: string, now: Date = new Date()) {
	const next = [
		{ address, lastUsed: now.toISOString() },
		...read().filter((each) => each.address !== address),
	].slice(0, KEPT);
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function forgetWallet(address: string) {
	try {
		localStorage.setItem(KEY, JSON.stringify(read().filter((each) => each.address !== address)));
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function useKnownWallets(): KnownWallet[] {
	return useSyncExternalStore(
		(changed) => {
			window.addEventListener(CHANGED, changed);
			window.addEventListener("storage", changed);
			return () => {
				window.removeEventListener(CHANGED, changed);
				window.removeEventListener("storage", changed);
			};
		},
		snapshot,
		() => [],
	);
}

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
