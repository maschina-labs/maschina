/**
 * Whether a machine may be retired, which is the last question anyone asks about it.
 *
 * Retiring is the one irreversible thing in the system. The wallet provider deletes the wallet and
 * its key, and a Solana key cannot be recovered or recreated. Anything still sitting at that address
 * afterwards is gone, permanently, with no support ticket that fixes it.
 *
 * So this refuses on anything it is not certain about, and the balances it judges come from the
 * chain rather than from the record: the record says what Maschina believes, and belief is not
 * evidence when the cost of being wrong is somebody's money disappearing forever.
 *
 * Five questions, in the order that costs least to answer:
 *
 *   - is it stopped, rather than running or merely paused
 *   - has every trade it started finished
 *   - is the trading account empty
 *   - is the vault empty
 *   - and for a machine on paper, only the first two, because it has no wallet to empty
 *
 * Retiring is not the same as withdrawing. `withdrawEverything` is what empties a machine, token
 * accounts closed so their rent comes back too. This is the gate that says the emptying worked.
 */

/** Rent for the wallet account itself. It cannot be withdrawn, so it is not money left behind. */
export const WALLET_RENT_LAMPORTS = 890_880n;

export const RETIRE_RULES = [
	"machine_stopped",
	"no_open_trades",
	"funds_remain",
	"vault_remains",
] as const;

export type RetireRule = (typeof RETIRE_RULES)[number];

export type RetireVerdict = { ok: true } | { ok: false; rule: RetireRule; reason: string };

/** What an account holds, as the chain reports it, empty token accounts included. */
export type HeldBalance = { lamports: bigint; tokens: readonly { mint: string; amount: bigint }[] };

export type RetireCheck = {
	/** From the record. Only a stopped machine is finished. */
	state: string;
	/**
	 * A machine on paper has an address whose key was dropped when it was made, so nothing on chain
	 * is its to lose and nothing at the provider is its to delete.
	 */
	paper: boolean;
	openTrades: number;
	/** The trading account, from the chain. Not needed for a machine on paper. */
	trading?: HeldBalance;
	/** Where profit is swept. Easy to forget, and it is the owner's money. */
	vault?: HeldBalance;
};

const refuse = (rule: RetireRule, reason: string): RetireVerdict => ({ ok: false, rule, reason });

/** What is still in an account, named, or nothing when it is empty. */
function whatIsLeft(held: HeldBalance | undefined): string | undefined {
	if (!held) return undefined;
	// An empty token account holds nothing. Closing it is how its rent comes back, and that is the
	// withdrawal's job, not a reason to refuse the retirement that follows it.
	const tokens = held.tokens.filter((token) => token.amount > 0n);
	if (tokens.length > 0) {
		return tokens.map((token) => `${token.amount} of ${token.mint}`).join(", ");
	}
	const spare = held.lamports - WALLET_RENT_LAMPORTS;
	return spare > 0n ? `${spare} lamports` : undefined;
}

export function canRetire(check: RetireCheck): RetireVerdict {
	// 1. Deleting the key of a machine that is still working is unrecoverable, and cheapest to catch.
	if (check.state !== "stopped") {
		return refuse(
			"machine_stopped",
			`the machine is ${check.state}, and only a stopped one is done`,
		);
	}

	// 2. An open trade may still land. Without its key, nothing can ever settle it.
	if (check.openTrades > 0) {
		return refuse(
			"no_open_trades",
			`${check.openTrades} trade(s) have not finished, and a landed one could never be settled`,
		);
	}

	// A paper machine has no wallet at the provider and no money on chain. Whatever an RPC says about
	// its address belongs to somebody else, so weighing it would refuse retirements for no reason.
	if (check.paper) return { ok: true };

	const left = whatIsLeft(check.trading);
	if (left) {
		return refuse("funds_remain", `the trading account still holds ${left}, which would be lost`);
	}

	const inVault = whatIsLeft(check.vault);
	if (inVault) {
		return refuse("vault_remains", `the vault still holds ${inVault}, which would be lost`);
	}

	return { ok: true };
}
