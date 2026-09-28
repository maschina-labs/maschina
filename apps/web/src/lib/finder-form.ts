import { followingRange } from "@maschina/runtime";
import { mostPerBuy, numberFrom, sixDecimals } from "./range-form.ts";

/**
 * The Range Finder's form, and the request it sends (D-089, D-093): a band that follows the price and a
 * floor under every buy, spending the float less the room the fee needs.
 */

export type FinderForm = {
	name: string;
	float: string;
	bandPct: number;
	floorPct: 3 | 5 | 8;
};

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

export function finderRequest(form: FinderForm) {
	const perBuy = mostPerBuy(form.float);
	return {
		name: form.name,
		kind: followingRange.kind,
		settings: {
			quoteMint: USDC,
			baseMint: SOL,
			bandBps: Math.round(form.bandPct * 100),
			floorBps: form.floorPct * 100,
			amountPerBuy: sixDecimals(perBuy),
			slippageBps: 50,
		},
		limits: {
			budgetGranted: sixDecimals(form.float),
			maxPerTrade: sixDecimals(perBuy),
			maxPerDay: sixDecimals(form.float),
			approvedMints: [USDC, SOL],
		},
	};
}

/** Named, and a float with room for a buy once the fee's headroom is kept back. */
export function finderReady(form: FinderForm): boolean {
	return form.name.trim().length > 0 && numberFrom(mostPerBuy(form.float) || "0") > 0;
}
