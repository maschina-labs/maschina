import type { PublicTrade } from "@maschina/contracts";
import type { StoredEvent } from "@maschina/db";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/**
 * Turns one machine's record into the trades anyone may see: only finished trades between USDC and SOL, newest
 * first, cut to the limit. A trade is "finished" when it has both an intent (which says which way it went) and a
 * completion (which carries the amounts and the signature). Everything else in the record is left behind on
 * purpose: refusals and their reasons, failures, runs, fees, ids and addresses. It builds each trade from six
 * named fields, never by copying a payload, so nothing extra can ride along.
 */
export function publicTrades(events: StoredEvent[], limit: number): PublicTrade[] {
	const directions = new Map<string, "buy" | "sell">();
	const trades: PublicTrade[] = [];
	for (const event of events) {
		const payload = event.payload as Record<string, unknown>;
		const tradeId = payload["tradeId"];
		if (typeof tradeId !== "string") continue;
		if (event.type === "trade.intended") {
			if (payload["inputMint"] === USDC && payload["outputMint"] === SOL)
				directions.set(tradeId, "buy");
			if (payload["inputMint"] === SOL && payload["outputMint"] === USDC)
				directions.set(tradeId, "sell");
			continue;
		}
		if (event.type !== "trade.completed") continue;
		const side = directions.get(tradeId);
		const signature = payload["signature"];
		const input = payload["inputAmount"];
		const output = payload["outputAmount"];
		if (
			!side ||
			typeof signature !== "string" ||
			typeof input !== "string" ||
			typeof output !== "string"
		)
			continue;
		trades.push({
			at: event.occurredAt.toISOString(),
			side,
			usdc: side === "buy" ? input : output,
			sol: side === "buy" ? output : input,
			signature,
		});
	}
	return trades.reverse().slice(0, limit);
}
