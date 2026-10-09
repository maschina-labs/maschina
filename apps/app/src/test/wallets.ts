import { vi } from "vitest";
import type { StandardWallet } from "../lib/wallet.ts";

/**
 * A wallet extension, as far as the Wallet Standard sees one: it announces itself with the standard's own
 * event, the way Solflare or Jupiter does, and offers the features a sign in uses.
 */
export function installWallet(
	name: string,
	address = "WaLLet",
	features: Partial<StandardWallet["features"]> = {},
) {
	const connect = vi.fn(async (_input?: { silent?: boolean }) => ({ accounts: [{ address }] }));
	const signMessage = vi.fn(async (..._input: { message: Uint8Array }[]) => [
		{ signature: new Uint8Array([1, 2, 3]) },
	]);
	const signAndSendTransaction = vi.fn(
		async (..._input: { transaction: Uint8Array; chain: string }[]) => [
			{ signature: new Uint8Array([4, 5, 6]) },
		],
	);
	const wallet: StandardWallet = {
		name,
		icon: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><title>${name}</title></svg>`)}`,
		chains: ["solana:mainnet"],
		features: {
			"standard:connect": { connect },
			"solana:signMessage": { signMessage },
			"solana:signAndSendTransaction": { signAndSendTransaction },
			...features,
		},
	};
	window.dispatchEvent(
		new CustomEvent("wallet-standard:register-wallet", {
			detail: (api: { register(...wallets: StandardWallet[]): void }) => api.register(wallet),
		}),
	);
	return { wallet, connect, signMessage, signAndSendTransaction };
}
