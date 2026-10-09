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
	const buy = numberFrom(buyAt);
	const sell = numberFrom(sellAt);
	if (!(buy > 0) || !(sell > buy)) return { width: 0, covers: false, keeps: 0 };
	const width = sell / buy - 1;
	return { width, covers: width >= ROUND_TRIP_COST, keeps: width - ROUND_TRIP_COST };
}

/**
 * What the signer holds back on top of a buy, for the fee sending it may cost, in dollars.
 *
 * The signer reserves its fee allowance (205,000 lamports by default) against the budget along with the
 * amount, so a buy of the whole float never fits and is refused every time the price reaches the bottom
 * edge. A quarter covers it with room to spare. Counting a fee in lamports against a budget in dollars is
 * its own debt; until it is paid, the form keeps a buy from spending the last of the float.
 */
export const FEE_HEADROOM = 0.25;

/** The most one buy may spend from a float, leaving the fee's headroom. Empty until a float is typed. */
export function mostPerBuy(float: string): string {
	const value = numberFrom(float);
	if (!(value > 0)) return "";
	return Math.max(value - FEE_HEADROOM, 0).toFixed(2);
}

/**
 * A number as a person types it: a dollar sign, commas and spaces are read as the number they decorate.
 * Anything else is not a number, rather than zero, so a mistyped price can never become a price of zero.
 */
export function numberFrom(typed: string): number {
	const cleaned = typed.replace(/[$,\s]/g, "");
	if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
	return Number(cleaned);
}

/**
 * Dollars or USDC as typed, to six decimal base units, as every amount crosses the wire. Only ever called
 * once the form is ready, so every value here has already been read as a number.
 */
export const sixDecimals = (value: string): string => {
	const read = numberFrom(value);
	if (!Number.isFinite(read)) throw new Error(`${value} is not a number`);
	return BigInt(Math.round(read * 1_000_000)).toString();
};

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
	const perBuy = numberFrom(form.perBuy);
	const float = numberFrom(form.float);
	return (
		filled &&
		bandOf(form.buyAt, form.sellAt).covers &&
		perBuy > 0 &&
		float > 0 &&
		perBuy <= float - FEE_HEADROOM
	);
}
