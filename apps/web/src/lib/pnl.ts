import type { RecordEntry } from "./machines.ts";
import { oldestFirst } from "./trades.ts";

/**
 * Realized profit over time, from machines' own records: each sale's proceeds less what the sold part
 * cost. Worked out the way the machines count it, from the trades that completed, so the chart and the
 * record can never disagree. Values are USDC base units.
 */

export type PnlPoint = { time: number; value: bigint };

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** One machine's realized result after each sale, in time order. */
export function realizedSteps(events: RecordEntry[]): PnlPoint[] {
	const intents = new Map<string, { input: string; output: string }>();
	const done = new Set<string>();
	let position = 0n;
	let basis = 0n;
	let realized = 0n;
	const steps: PnlPoint[] = [];
	for (const event of oldestFirst(events)) {
		const p = event.payload as Record<string, string>;
		if (event.type === "trade.intended") {
			intents.set(p["tradeId"] ?? "", {
				input: p["inputMint"] ?? "",
				output: p["outputMint"] ?? "",
			});
			continue;
		}
		if (event.type !== "trade.completed") continue;
		const id = p["tradeId"] ?? "";
		const intent = intents.get(id);
		if (!intent || done.has(id)) continue;
		done.add(id);
		const spent = BigInt(p["inputAmount"] ?? "0");
		const got = BigInt(p["outputAmount"] ?? "0");
		if (intent.input === USDC) {
			basis += spent;
			position += got;
		} else if (intent.output === USDC && position > 0n) {
			const sold = spent > position ? position : spent;
			const cost = (basis * sold) / position;
			realized += got - cost;
			basis -= cost;
			position -= sold;
			steps.push({ time: Math.floor(Date.parse(event.occurredAt) / 1000), value: realized });
		}
	}
	return steps;
}

/** Every machine's steps added into one running total, one point per sale. */
export function portfolioPnl(records: RecordEntry[][]): PnlPoint[] {
	const changes: { time: number; delta: bigint }[] = [];
	for (const events of records) {
		let before = 0n;
		for (const step of realizedSteps(events)) {
			changes.push({ time: step.time, delta: step.value - before });
			before = step.value;
		}
	}
	changes.sort((a, b) => a.time - b.time);
	let total = 0n;
	return changes.map((change) => {
		total += change.delta;
		return { time: change.time, value: total };
	});
}
