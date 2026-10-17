/**
 * The signer never asks the wallet provider about a paper machine.
 *
 * A machine on paper has no wallet at the provider: its address was generated once and the key
 * dropped, so there is nothing there to sign with. Nothing should ever route one here, and the
 * database refuses a machine that holds real money carrying a paper wallet, so this is the third
 * line rather than the first. It exists because of what the second line costs if it is ever wrong:
 * an unexplained provider error in the middle of the money path, debugged against the wrong system.
 *
 * So it refuses here, by name, before the request leaves the building.
 */

import { err, type Result } from "@maschina/core";
import { type ProviderError, providerError, type WalletProvider } from "@maschina/wallet";

/** What a paper machine's provider wallet id starts with. Written by the provisioner. */
export const PAPER_WALLET_PREFIX = "paper:";

const refuse = <T>(what: string): Result<T, ProviderError> =>
	err(
		providerError(
			"invalid",
			`a paper machine has no wallet at the provider, so it cannot ${what}: nothing holds its key`,
		),
	);

/** The same provider, except that a paper machine's wallet id is refused before it is used. */
export function neverSignsPaper(provider: WalletProvider): WalletProvider {
	const isPaper = (walletId: string) => walletId.startsWith(PAPER_WALLET_PREFIX);
	return {
		name: provider.name,
		createWallet: (input) => provider.createWallet(input),
		readPolicy: async (walletId, account) =>
			isPaper(walletId) ? refuse("have a policy read") : provider.readPolicy(walletId, account),
		sign: async (walletId, unsignedTransaction, account) =>
			isPaper(walletId)
				? refuse("be signed with")
				: provider.sign(walletId, unsignedTransaction, account),
		setRecipients: async (walletId, recipients) =>
			isPaper(walletId)
				? refuse("have its recipients changed")
				: provider.setRecipients(walletId, recipients),
	};
}
