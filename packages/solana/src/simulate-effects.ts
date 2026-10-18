/**
 * Measuring a transaction against the chain, without sending it.
 *
 * This is the half of F-01 that touches the network: read the wallet, simulate the exact bytes, read
 * the wallet as it would then be, and hand both readings to `effectsFrom`. The judging happens in
 * `derive-effects.ts`, which is pure and knows nothing about RPCs.
 *
 * Two details matter more than they look.
 *
 * **Accounts that do not exist yet are watched anyway.** The first purchase of a token creates its
 * account inside the transaction, so it is absent from the wallet's current holdings. Asking the
 * simulation only about accounts that already exist would miss the entire gain and make every first
 * buy look like money leaving for nothing. Both token programs are named for each mint, because which
 * one a mint belongs to is a fact on chain and this does not read it; the one that does not apply
 * simply never exists.
 *
 * **It fails closed.** An unreachable node refuses the trade. That costs trades during an outage,
 * which is the cheaper mistake: the other way round signs unmeasured transactions during exactly the
 * window an attacker would pick.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import type { Address } from "./address.ts";
import {
	type BalanceReader,
	type FetchedTokenAccount,
	parseTokenAccount,
	readBalances,
	type WalletBalances,
} from "./balances.ts";
import { effectsFrom, type WalletEffects } from "./derive-effects.ts";
import { TOKEN_2022_PROGRAM, TOKEN_PROGRAM, tokenAccountFor } from "./token-account.ts";

/** What a simulation answers: the wallet as it would be, or why it could not be run. */
export type Simulated =
	| { ok: true; lamports: bigint; accounts: readonly FetchedTokenAccount[] }
	| { ok: false; problem: string };

/**
 * Runs a transaction without sending it and reports the named accounts as they would then be.
 *
 * An account that does not exist, before or after, is simply left out of the answer.
 */
export type SimulateTransaction = (
	transaction: Uint8Array,
	addresses: readonly string[],
) => Promise<Simulated>;

export type SimulationPorts = { balances: BalanceReader; simulate: SimulateTransaction };

export type SimulationRequest = {
	transaction: Uint8Array;
	wallet: Address;
	/** The tokens this transaction says it touches, so their accounts are watched even if new. */
	mints: readonly string[];
};

/** Every account worth watching: the wallet, what it already holds, and where the trade could land. */
async function accountsToWatch(
	wallet: Address,
	holding: WalletBalances,
	mints: readonly string[],
): Promise<string[]> {
	const possible = await Promise.all(
		[...new Set(mints)].flatMap((mint) =>
			[TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map((tokenProgram) =>
				tokenAccountFor({ owner: wallet, mint, tokenProgram }),
			),
		),
	);
	return [
		...new Set<string>([wallet, ...holding.tokens.map((token) => token.account), ...possible]),
	];
}

/** The wallet as the simulation says it would be, keeping only accounts it still owns. */
function walletAfter(
	wallet: Address,
	simulated: readonly FetchedTokenAccount[],
	lamports: bigint,
): WalletBalances {
	const tokens = [];
	for (const account of simulated) {
		let parsed: ReturnType<typeof parseTokenAccount>;
		try {
			parsed = parseTokenAccount(account);
		} catch {
			// Not a token account. The wallet's own account comes back among these and is read for
			// lamports instead, so this is expected rather than a problem.
			continue;
		}
		// An account the wallet does not own cannot change what the wallet holds. A node answering
		// with somebody else's would otherwise invent a balance out of nothing.
		if (parsed.owner === wallet) tokens.push(parsed);
	}
	return { wallet, lamports: lamports as WalletBalances["lamports"], tokens };
}

/**
 * What the transaction would do to this wallet.
 *
 * The reading of the wallet happens before the simulation, never alongside it: comparing against a
 * state read afterwards would measure against the wrong moment.
 */
export async function simulateEffects(
	ports: SimulationPorts,
	request: SimulationRequest,
): Promise<Result<WalletEffects, MaschinaError>> {
	let before: WalletBalances;
	let watching: string[];
	try {
		before = await readBalances(ports.balances, request.wallet);
		watching = await accountsToWatch(request.wallet, before, request.mints);
	} catch (cause) {
		return err(
			new MaschinaError("unavailable", "the wallet could not be read, so nothing is signed", {
				cause,
			}),
		);
	}

	let simulated: Simulated;
	try {
		simulated = await ports.simulate(request.transaction, watching);
	} catch (cause) {
		return err(
			new MaschinaError(
				"unavailable",
				"the transaction could not be simulated, so nothing is signed",
				{
					cause,
				},
			),
		);
	}

	if (!simulated.ok) {
		return err(
			new MaschinaError("invalid_input", `the transaction would fail: ${simulated.problem}`),
		);
	}

	return ok(
		effectsFrom(before, walletAfter(request.wallet, simulated.accounts, simulated.lamports)),
	);
}
