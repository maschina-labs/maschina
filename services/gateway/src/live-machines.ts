/**
 * Who may put real money into a machine.
 *
 * Paper is open to everyone: a paper machine runs the same code against live prices and never asks
 * the wallet provider for a signature, so there is nothing to lose and nothing to gate. Real money
 * is the other way round. Until the signer judges a transaction's own bytes rather than believing
 * what a node claims they spend, and until there has been an independent audit, the only funds that
 * belong in a machine are the founder's. This is the door that keeps it that way, and it is shut by
 * default: configure nobody and nobody may run on real money, including the founder.
 *
 * It is a decision made in the gateway's configuration, never a field in a request, so no caller can
 * ask to be on the list. A wallet address is the key because the owner's wallet comes from the
 * session rather than the body: there is nothing a request can say to change which wallet it is.
 *
 * This is the near-term gate, not the limits. Per-machine and per-owner caps are a separate thing
 * and are enforced separately.
 */

/** The wallets a configured list names. Unset, empty or only separators means nobody. */
export function whoMayRunOnRealMoney(configured: string | undefined): string[] {
	return (configured ?? "")
		.split(",")
		.map((wallet) => wallet.trim())
		.filter((wallet) => wallet.length > 0);
}

/**
 * Whether this owner may create this machine. Paper always. Real money only for a wallet on the
 * list, compared whole and exactly: an address that differs by a space or a letter's case is a
 * different address, and treating it as the same is how a gate stops being one.
 */
export function mayRunOnRealMoney({
	paper,
	ownerWallet,
	allowed,
}: {
	paper: boolean;
	ownerWallet: string;
	allowed: string[];
}): boolean {
	if (paper) return true;
	if (ownerWallet.length === 0) return false;
	return allowed.includes(ownerWallet);
}
