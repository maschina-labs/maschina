import { amount, type MachineSummary, type RecordEntry } from "./machines.ts";
import { tradesFrom } from "./trades.ts";

/**
 * The analyst's brief on one machine: short findings, most important first, each backed by the record.
 * Rules write it now; the AI takes over writing it later, from the same record and under the same rule:
 * nothing it says may go beyond what the record shows.
 */
export type Finding = { level: "note" | "watch"; text: string };

export function briefOn(
	machine: MachineSummary,
	record: RecordEntry[],
	price: number | undefined,
): Finding[] {
	const out: Finding[] = [];
	const position = BigInt(machine.result.position);
	const basis = BigInt(machine.result.basis);
	if (position > 0n && basis > 0n && price !== undefined) {
		const paid = (Number(basis) / Number(position)) * 1000;
		const move = (price - paid) / paid;
		out.push({
			level: move < -0.01 ? "watch" : "note",
			text: `HOLDING ${amount(machine.result.position, 9)} SOL · PAID ${paid.toFixed(2)} · ${move >= 0 ? "UP" : "DOWN"} ${(Math.abs(move) * 100).toFixed(1)}%`,
		});
		if (machine.kind === "range" && move < 0)
			out.push({
				level: "watch",
				text: "A FIXED RANGE HAS NO FLOOR · A RANGE FINDER WOULD CAP THE LOSS",
			});
	}
	const trades = tradesFrom(record);
	out.push({
		level: "note",
		text:
			trades.length === 0
				? "NO TRADES YET"
				: `${trades.length} TRADES · REALISED ${amount(machine.result.realised)} USDC`,
	});
	const skips = record.filter((entry) => entry.type === "run.skipped").length;
	if (skips > 0)
		out.push({ level: "note", text: `${skips} RUNS DID NOTHING · EACH ONE SAYS WHY IN THE LOG` });
	const problems = record.filter(
		(entry) => entry.type === "trade.failed" || entry.type === "trade.refused",
	).length;
	if (problems > 0) out.push({ level: "watch", text: `${problems} TRADES FAILED OR WERE REFUSED` });
	if (machine.state === "stopped")
		out.push({ level: "watch", text: "STOPPED · WITHDRAW WHAT IT HOLDS" });
	return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "watch" ? -1 : 1));
}
