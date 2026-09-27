/**
 * The arithmetic behind the range machine's form, kept apart from the page so it can be proved.
 *
 * A band narrower than a round trip costs loses money every time the machine works exactly as designed.
 * The form says so as the owner types, and the server refuses it as well; the two use the same floor.
 */

/** What a round trip costs, as a share of what is traded. The server holds the same floor. */
export const ROUND_TRIP_COST = 0.006;

export type Band = {
	/** How wide the band is, as a share of the buy price. Zero until both prices make sense. */
	width: number;
	/** True when the band is wide enough to pay for working it. */
	covers: boolean;
	/** What a round trip keeps after costs, as a share. Negative when it would lose money. */
	keeps: number;
};

export function bandOf(buyAt: string, sellAt: string): Band {
	const buy = Number(buyAt);
	const sell = Number(sellAt);
	if (!(buy > 0) || !(sell > buy)) return { width: 0, covers: false, keeps: 0 };
	const width = sell / buy - 1;
	return { width, covers: width >= ROUND_TRIP_COST, keeps: width - ROUND_TRIP_COST };
}

/** Dollars or USDC as typed, to six decimal base units, as every amount crosses the wire. */
export const sixDecimals = (value: string): string =>
	BigInt(Math.round(Number(value) * 1_000_000)).toString();

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/** The request that makes a range machine, from what was typed. */
export function rangeRequest(form: {
	name: string;
	kind: string;
	buyAt: string;
	sellAt: string;
	perBuy: string;
	float: string;
}) {
	return {
		name: form.name,
		kind: form.kind,
		settings: {
			quoteMint: USDC,
			baseMint: SOL,
			buyLevel: sixDecimals(form.buyAt),
			sellLevel: sixDecimals(form.sellAt),
			amountPerBuy: sixDecimals(form.perBuy),
			slippageBps: 50,
		},
		limits: {
			// The float is the grant: what it trades with, and the line profit is banked above.
			budgetGranted: sixDecimals(form.float),
			maxPerTrade: sixDecimals(form.perBuy),
			maxPerDay: sixDecimals(form.float),
			approvedMints: [USDC, SOL],
		},
	};
}

/** Whether the form is ready to send: named, a band that pays, and no buy bigger than the float. */
export function rangeReady(form: {
	name: string;
	buyAt: string;
	sellAt: string;
	perBuy: string;
	float: string;
}): boolean {
	const filled = [form.name, form.buyAt, form.sellAt, form.perBuy, form.float].every(
		(value) => value.trim().length > 0,
	);
	const perBuy = Number(form.perBuy);
	const float = Number(form.float);
	return (
		filled && bandOf(form.buyAt, form.sellAt).covers && perBuy > 0 && float > 0 && perBuy <= float
	);
}
