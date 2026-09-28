/**
 * What a machine holds because it traded, worked out from its record.
 *
 * A wallet is not a position. A real machine's wallet also holds the SOL its owner sent to pay fees, and
 * anything anybody else chooses to send it. A range that read its wallet counted 0.012 SOL of fee money
 * as a position and refused every buy (M35). So whether a machine is in the market, and how much it has
 * to sell, comes from what its own trades bought less what they sold.
 *
 * Paper trades count from what their quote said, so a machine on paper holds exactly what it would
 * have held for real.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";

export function positionsFrom(events: Iterable<RecordedEvent>): ReadonlyMap<string, BaseUnits> {
	const intents = new Map<string, { inputMint: string; outputMint: string }>();
	const counted = new Set<string>();
	const held = new Map<string, bigint>();
	const move = (mint: string, by: bigint) => held.set(mint, (held.get(mint) ?? 0n) + by);

	for (const event of events) {
		if (event.type === "trade.intended") {
			const { tradeId, inputMint, outputMint } = event.payload;
			if (!intents.has(tradeId)) intents.set(tradeId, { inputMint, outputMint });
			continue;
		}
		const done =
			event.type === "trade.completed"
				? {
						tradeId: event.payload.tradeId,
						mints: intents.get(event.payload.tradeId),
						spent: BigInt(event.payload.inputAmount),
						got: BigInt(event.payload.outputAmount),
					}
				: event.type === "trade.simulated"
					? {
							tradeId: event.payload.tradeId,
							mints: {
								inputMint: event.payload.inputMint,
								outputMint: event.payload.outputMint,
							},
							spent: BigInt(event.payload.inputAmount),
							got: BigInt(event.payload.quotedOutputAmount),
						}
					: undefined;
		// The record may be read again from the start at any time and has to give the same answer.
		if (!done?.mints || counted.has(done.tradeId)) continue;
		counted.add(done.tradeId);
		move(done.mints.inputMint, -done.spent);
		move(done.mints.outputMint, done.got);
	}

	// Below zero means it spent what its owner funded it with, which is not a position in anything.
	const positions = new Map<string, BaseUnits>();
	for (const [mint, amount] of held) if (amount > 0n) positions.set(mint, baseUnitsOf(amount));
	return positions;
}
