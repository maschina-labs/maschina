/**
 * What a machine on paper holds, worked out from its record.
 *
 * A machine on paper has a real wallet that stays empty, so its holdings cannot be read from the chain.
 * They are the sum of the trades it would have made: what each one bought, less what each one spent.
 *
 * This is not a detail of the simulation. A machine that closes what it opened has to be able to see
 * what it is holding, or it cannot tell an open position from a closed one. Without this a range machine
 * on paper buys its low edge, looks at an empty wallet, and buys again on the next crossing, forever,
 * against a rule that explicitly refuses a second position. Paper is only worth something if the machine
 * sees what it would really have seen.
 *
 * Real trades are ignored. Those moved real tokens, and the chain already says so.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";

/**
 * Holdings by mint, never below nothing, and a mint held at zero is left out entirely.
 *
 * Both of those are what a wallet does. Nothing can hold less than nothing, and a token you have none of
 * is a token you do not have. Keeping a zero would make a machine that sold its whole position look like
 * it was still in the market.
 */
export function paperHoldings(events: Iterable<RecordedEvent>): ReadonlyMap<string, BaseUnits> {
	const held = new Map<string, bigint>();
	const counted = new Set<string>();

	const move = (mint: string, by: bigint) => {
		held.set(mint, (held.get(mint) ?? 0n) + by);
	};

	for (const event of events) {
		if (event.type !== "trade.simulated") continue;
		const { tradeId, inputMint, outputMint, inputAmount, quotedOutputAmount } = event.payload;
		// The record may be read again from the beginning at any time and must give the same answer.
		if (counted.has(tradeId)) continue;
		counted.add(tradeId);

		move(inputMint, -BigInt(inputAmount));
		move(outputMint, BigInt(quotedOutputAmount));
	}

	const balances = new Map<string, BaseUnits>();
	for (const [mint, amount] of held) {
		if (amount > 0n) balances.set(mint, baseUnitsOf(amount));
	}
	return balances;
}
