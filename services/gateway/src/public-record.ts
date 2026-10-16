import type { PaperTrade, PublicRecord, PublicTrade } from "@maschina/contracts";
import type { StoredEvent } from "@maschina/db";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/** Which way a trade went, worked out from the mints it names. Anything else is not shown at all. */
function sideOf(payload: Record<string, unknown>): "buy" | "sell" | undefined {
	if (payload["inputMint"] === USDC && payload["outputMint"] === SOL) return "buy";
	if (payload["inputMint"] === SOL && payload["outputMint"] === USDC) return "sell";
	return undefined;
}

const text = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

/**
 * Turns the record into what anyone may see: real money and paper, kept apart.
 *
 * Only finished trades between USDC and SOL. A real trade is finished when it has both an intent,
 * which says which way it went, and a completion, which carries the amounts and the signature. A
 * paper trade is a single simulated event, which already names its own mints and amounts because
 * nothing was ever sent.
 *
 * Everything else in the record is left behind on purpose: refusals and their reasons, failures,
 * runs, fees, ids and addresses. Every trade is built from named fields, never by copying a payload,
 * so nothing extra can ride along.
 *
 * The two lists are never merged here and must never be merged by a caller (D-096). A paper trade
 * carries no signature at all, so there is nothing for a page to link to for a trade that did not
 * happen.
 */
export function publicTrades(events: StoredEvent[], limit: number): PublicRecord {
	const directions = new Map<string, "buy" | "sell">();
	const live: PublicTrade[] = [];
	const paper: PaperTrade[] = [];

	for (const event of events) {
		const payload = event.payload as Record<string, unknown>;
		const tradeId = text(payload["tradeId"]);
		if (tradeId === undefined) continue;
		const at = event.occurredAt.toISOString();

		if (event.type === "trade.intended") {
			const side = sideOf(payload);
			if (side) directions.set(tradeId, side);
			continue;
		}

		// A machine on paper: one event, self contained, and no signature because nothing was signed.
		if (event.type === "trade.simulated") {
			const side = sideOf(payload);
			const input = text(payload["inputAmount"]);
			const output = text(payload["quotedOutputAmount"]);
			if (!side || input === undefined || output === undefined) continue;
			paper.push({
				at,
				side,
				usdc: side === "buy" ? input : output,
				sol: side === "buy" ? output : input,
			});
			continue;
		}

		if (event.type !== "trade.completed") continue;
		const side = directions.get(tradeId);
		const signature = text(payload["signature"]);
		const input = text(payload["inputAmount"]);
		const output = text(payload["outputAmount"]);
		if (!side || signature === undefined || input === undefined || output === undefined) continue;
		live.push({
			at,
			side,
			usdc: side === "buy" ? input : output,
			sol: side === "buy" ? output : input,
			signature,
		});
	}

	return { live: live.reverse().slice(0, limit), paper: paper.reverse().slice(0, limit) };
}
