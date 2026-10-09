/**
 * Where a transaction is shown when someone wants to check it for themselves: the block explorer the
 * owner prefers, kept per browser. Solscan unless they choose another.
 */

import { useSyncExternalStore } from "react";

export const EXPLORERS = {
	solscan: { name: "Solscan", tx: (signature: string) => `https://solscan.io/tx/${signature}` },
	solana: {
		name: "Solana Explorer",
		tx: (signature: string) => `https://explorer.solana.com/tx/${signature}`,
	},
	solanafm: { name: "SolanaFM", tx: (signature: string) => `https://solana.fm/tx/${signature}` },
} as const;

export type Explorer = keyof typeof EXPLORERS;

const KEY = "maschina.explorer";
const CHANGED = "maschina:explorer";

function read(): Explorer {
	try {
		const saved = localStorage.getItem(KEY);
		return saved && saved in EXPLORERS ? (saved as Explorer) : "solscan";
	} catch {
		return "solscan";
	}
}

export function setExplorer(explorer: Explorer) {
	try {
		localStorage.setItem(KEY, explorer);
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function useExplorer(): Explorer {
	return useSyncExternalStore(
		(changed) => {
			window.addEventListener(CHANGED, changed);
			return () => window.removeEventListener(CHANGED, changed);
		},
		read,
		() => "solscan",
	);
}

/** A transaction's page on the owner's explorer. */
export const txUrl = (explorer: Explorer, signature: string) => EXPLORERS[explorer].tx(signature);
