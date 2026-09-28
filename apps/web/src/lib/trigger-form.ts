import { priceTrigger } from "@maschina/runtime";
import type { NewMachine } from "./machines.ts";
import { FEE_HEADROOM, numberFrom, sixDecimals } from "./range-form.ts";

/**
 * A limit order, made into a machine: buy SOL with USDC once the price falls to a level. The same checks
 * as every machine: its budget is the buy plus room for the fee to send it.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

export type LimitForm = { level: string; spend: string; paper: boolean };

export function limitReady(form: LimitForm): boolean {
	return numberFrom(form.level) > 0 && numberFrom(form.spend) > 0;
}

export function limitRequest(form: LimitForm): NewMachine {
	const spend = numberFrom(form.spend);
	return {
		name: `Buy SOL at ${numberFrom(form.level).toFixed(2)}`,
		kind: priceTrigger.kind,
		paper: form.paper,
		settings: {
			spendMint: USDC,
			buyMint: SOL,
			level: sixDecimals(form.level),
			direction: "falls_to",
			amountPerTrade: sixDecimals(form.spend),
			slippageBps: 50,
			hysteresisBps: 50,
			minGapMs: 3_600_000,
		},
		limits: {
			budgetGranted: sixDecimals((spend + FEE_HEADROOM).toFixed(2)),
			maxPerTrade: sixDecimals(form.spend),
			maxPerDay: sixDecimals((spend + FEE_HEADROOM).toFixed(2)),
			approvedMints: [USDC, SOL],
		},
	};
}
