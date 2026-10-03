/**
 * Exit plans: how each holding gets out, set by the AI when it buys and kept by the engine on every tick.
 *
 * The AI decides the plan; the engine carries it out in seconds, without waiting for the AI to look
 * again. That is where the speed comes from: a model takes seconds to think, a price check takes
 * milliseconds.
 *
 * The owner's own stop is the floor. A plan can stop out sooner than it, never later.
 */

import type { Holding } from "./book.ts";

export type ExitPlan = {
	/** Sell once up this far from cost. Percent. */
	takeProfitPct?: number;
	/** Sell once down this far from cost. Percent; never looser than the owner's stop. */
	stopPct?: number;
	/** Once up at least this far, sell if it falls this far from its best. Percent. */
	trailPct?: number;
	/** The most it has been worth since it was bought, in USDC's smallest unit. */
	peak?: string;
};

export type Exit = { reason: string; kind: "stop" | "sell" };

const pctFrom = (value: bigint, base: bigint) => (Number(value - base) / Number(base)) * 100;

/** Whether a holding should be sold now, and why, given what it is worth. */
export function exitFor(
	held: Holding,
	value: bigint | undefined,
	plan: ExitPlan | undefined,
	ownerStopPct: number,
): Exit | undefined {
	if (value === undefined || held.cost === 0n) return undefined;
	const change = pctFrom(value, held.cost);
	const stop = Math.min(plan?.stopPct ?? ownerStopPct, ownerStopPct);
	if (change <= -stop) return { kind: "stop", reason: `down ${stop}% or more from what it cost` };
	if (plan?.takeProfitPct !== undefined && change >= plan.takeProfitPct)
		return {
			kind: "sell",
			reason: `took profit at +${change.toFixed(1)}%, the plan was +${plan.takeProfitPct}%`,
		};
	if (plan?.trailPct !== undefined && plan.peak !== undefined) {
		const peak = BigInt(plan.peak);
		const armed = pctFrom(peak, held.cost) >= plan.trailPct;
		const fromPeak = -pctFrom(value, peak);
		if (armed && fromPeak >= plan.trailPct)
			return {
				kind: "sell",
				reason: `fell ${fromPeak.toFixed(1)}% from its best, past the ${plan.trailPct}% trail, at ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
			};
	}
	return undefined;
}

/** The plan with its best seen value brought up to date. */
export function withPeak(
	plan: ExitPlan | undefined,
	value: bigint | undefined,
): ExitPlan | undefined {
	if (!plan || value === undefined) return plan;
	const peak =
		plan.peak === undefined ? value : BigInt(plan.peak) > value ? BigInt(plan.peak) : value;
	return { ...plan, peak: peak.toString() };
}

/** A plan from what the AI asked for, with anything nonsensical left out. */
export function planFrom(input: Record<string, unknown>): ExitPlan {
	const pct = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1000
			? value
			: undefined;
	const plan: ExitPlan = {};
	const take = pct(input["takeProfitPct"]);
	const stop = pct(input["stopPct"]);
	const trail = pct(input["trailPct"]);
	if (take !== undefined) plan.takeProfitPct = take;
	if (stop !== undefined) plan.stopPct = stop;
	if (trail !== undefined) plan.trailPct = trail;
	return plan;
}
