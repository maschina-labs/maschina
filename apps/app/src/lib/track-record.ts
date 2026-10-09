import { describeEvent } from "./describe.ts";
import type { RecordEntry } from "./machines.ts";
import { realizedSteps } from "./pnl.ts";
import { tradesFrom } from "./trades.ts";

/**
 * A machine's track record, from its record alone: how well its trades were executed against their
 * quotes, its largest drop, and how it did against simply holding SOL from its first buy (#191 to #195).
 */

/** Average of what each trade got against what it was quoted, in basis points. Negative means it got less. */
export function executionBps(record: RecordEntry[]): number | undefined {
	const quoted = new Map<string, number>();
	const gaps: number[] = [];
	for (const entry of record) {
		const p = entry.payload as Record<string, string>;
		if (entry.type === "trade.intended")
			quoted.set(p["tradeId"] ?? "", Number(p["quotedOutputAmount"]));
		if (entry.type === "trade.completed") {
			const quote = quoted.get(p["tradeId"] ?? "");
			const got = Number(p["outputAmount"]);
			if (quote && Number.isFinite(got)) gaps.push(((got - quote) / quote) * 10_000);
		}
	}
	return gaps.length === 0 ? undefined : gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

/** The largest fall in realized profit from a high to a later low, in USDC base units. */
export function largestDrop(record: RecordEntry[]): bigint {
	let peak = 0n;
	let drop = 0n;
	for (const step of realizedSteps(record)) {
		if (step.value > peak) peak = step.value;
		if (peak - step.value > drop) drop = peak - step.value;
	}
	return drop;
}

/** What just holding SOL from the first buy would have done, as a fraction, against the price now. */
export function holdingReturn(
	record: RecordEntry[],
	price: number | undefined,
): number | undefined {
	const first = tradesFrom(record).find((trade) => trade.side === "buy");
	if (!first || price === undefined) return undefined;
	return (price - first.price) / first.price;
}

/** The whole record as CSV, one event per line, for tax and accounting (#479). */
export function recordCsv(record: RecordEntry[]): string {
	const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
	const lines = record.map((entry) => {
		const said = describeEvent(entry);
		const signature = (entry.payload as Record<string, unknown>)["signature"];
		return [
			entry.occurredAt,
			entry.type,
			said.title,
			said.detail,
			typeof signature === "string" ? signature : "",
		]
			.map(cell)
			.join(",");
	});
	return ["time,type,what,detail,signature", ...lines].join("\n");
}
