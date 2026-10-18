/**
 * What a transaction actually does to a wallet, and whether that matches what was claimed.
 *
 * The signer used to judge a trade by reading the node's description of it: this is 40 USDC becoming
 * SOL. The rules then checked 40 USDC against the budget. Nothing checked that the bytes about to be
 * signed did what the sentence said, so a node that lied, or that had been compromised, could spend
 * whatever it liked inside a claim the rules were happy with (F-01).
 *
 * The fix is not to decode the router's instruction. Jupiter's encoding changes with routes and
 * versions, so a decoder is a thing that breaks the week they ship a new one, and a broken decoder on
 * the money path fails in the worst possible direction. Instead the transaction is simulated and the
 * wallet is measured before and after. The transaction testifies about itself, and the claim becomes
 * a cross-check rather than evidence. That holds however the router changes, whichever DEX a route
 * crosses, and whoever wrote the node.
 *
 * Both functions here are pure. All the chain access lives with the caller, which is what makes this
 * testable without a network and what makes it the first clean candidate for the Rust port: its test
 * vectors become the conformance suite.
 */

import type { BaseUnits } from "@maschina/core";
import type { WalletBalances } from "./balances.ts";

/** One token whose balance moved, and by how much. Negative left the wallet. */
export type TokenDelta = { mint: string; delta: bigint };

/** Everything a transaction changed about a wallet. Tokens that did not move are left out. */
export type WalletEffects = {
	/** Lamports gained or lost. Negative is normal: fees and rent come out of here. */
	lamports: bigint;
	/** Every token whose total moved, in the order it was first seen. */
	tokens: TokenDelta[];
};

/** What the caller said the transaction would do, and what it is allowed to cost. */
export type SwapClaim = {
	inputMint: string;
	outputMint: string;
	/** Exactly what should leave. An ExactIn swap fixes this in the instruction, so it is not a range. */
	inputAmount: BaseUnits | bigint;
	/** The least that may come back. The market decides the rest. */
	minimumOutputAmount: BaseUnits | bigint;
	/** The most SOL that fees and rent may legitimately consume. */
	lamportsAllowed: BaseUnits | bigint;
};

export type SwapVerdict = { ok: true } | { ok: false; rule: "derived_mismatch"; problem: string };

/**
 * Every token a wallet holds, totalled by mint.
 *
 * Totalled rather than listed, because a wallet can hold more than one account for the same token and
 * a swap that drained the second one while filling the first would otherwise net out to nothing.
 */
function totals(balances: WalletBalances): Map<string, bigint> {
	const byMint = new Map<string, bigint>();
	for (const token of balances.tokens) {
		byMint.set(token.mint, (byMint.get(token.mint) ?? 0n) + BigInt(token.amount));
	}
	return byMint;
}

/**
 * What changed between two readings of the same wallet.
 *
 * A token missing from one side counts as zero there, not as absent: the first buy of a token creates
 * its account, and selling the last of one closes it, so both ends of a trade routinely have no
 * counterpart. Treating absence as zero is what makes those two cases ordinary rather than special.
 */
export function effectsFrom(before: WalletBalances, after: WalletBalances): WalletEffects {
	const was = totals(before);
	const now = totals(after);
	const tokens: TokenDelta[] = [];

	for (const mint of [...was.keys(), ...now.keys()]) {
		if (tokens.some((token) => token.mint === mint)) continue;
		const delta = (now.get(mint) ?? 0n) - (was.get(mint) ?? 0n);
		if (delta !== 0n) tokens.push({ mint, delta });
	}

	return { lamports: BigInt(after.lamports) - BigInt(before.lamports), tokens };
}

/**
 * Whether what happened is the swap that was promised.
 *
 * Five things have to hold, and none of them is a judgement call:
 *
 *   - exactly the claimed amount of the claimed token left
 *   - at least the minimum of the claimed token arrived
 *   - no other token left the wallet
 *   - SOL fell by no more than fees and rent could explain
 *   - something actually happened
 *
 * The input is checked exactly because an ExactIn swap's instruction fixes it: there is no market
 * uncertainty in what goes out, only in what comes back. The output is a floor rather than an
 * equality for the opposite reason. So this needs no tolerance anywhere, which matters, because a
 * tolerance is a number somebody picks and then nobody revisits.
 */
export function judgeSwap(effects: WalletEffects, claim: SwapClaim): SwapVerdict {
	const refuse = (problem: string): SwapVerdict => ({
		ok: false,
		rule: "derived_mismatch",
		problem,
	});

	const spent = BigInt(claim.inputAmount);
	const minimum = BigInt(claim.minimumOutputAmount);
	const allowed = BigInt(claim.lamportsAllowed);

	if (effects.tokens.length === 0) {
		return refuse("the transaction moved no tokens at all, so it is not the trade it claims to be");
	}

	const input = effects.tokens.find((token) => token.mint === claim.inputMint);
	if (!input || input.delta >= 0n) {
		return refuse(
			`nothing was spent of ${claim.inputMint}, which is the token it said it would spend`,
		);
	}
	if (-input.delta !== spent) {
		return refuse(
			`it spent ${-input.delta} of ${claim.inputMint} while claiming to spend ${spent}`,
		);
	}

	// Buying SOL means the output arrives as lamports once the wrapped account is closed, so a swap
	// into SOL is allowed to show its gain either as the wrapped token or as native lamports.
	const output = effects.tokens.find((token) => token.mint === claim.outputMint);
	const received = output && output.delta > 0n ? output.delta : 0n;
	if (received < minimum) {
		return refuse(
			`it received ${received} of ${claim.outputMint} while the rules required at least ${minimum}`,
		);
	}

	const others = effects.tokens.filter(
		(token) => token.delta < 0n && token.mint !== claim.inputMint,
	);
	const leaked = others[0];
	if (leaked) {
		return refuse(
			`${-leaked.delta} of ${leaked.mint} left the wallet, and a swap moves only the token it names`,
		);
	}

	if (effects.lamports < 0n && -effects.lamports > allowed) {
		return refuse(
			`${-effects.lamports} lamports left the wallet, more than the ${allowed} that fees and rent allow`,
		);
	}

	return { ok: true };
}
