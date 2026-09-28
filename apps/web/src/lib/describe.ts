import { amount, type RecordEntry } from "./machines.ts";

/**
 * What a record entry means, in words a person reads: a short title and one line of detail. The record
 * itself stays exact; this is only how it is said on screen.
 */
export type Described = { title: string; detail: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function describeEvent(entry: RecordEntry): Described {
	const p = entry.payload;
	switch (entry.type) {
		case "machine.created":
			return { title: "CREATED", detail: "WALLET MADE, POLICY WRITTEN" };
		case "machine.started":
			return { title: "STARTED", detail: "WATCHING THE PRICE" };
		case "machine.paused":
			return { title: "PAUSED", detail: "NOT ACTING UNTIL RESUMED" };
		case "machine.resumed":
			return { title: "RESUMED", detail: "WATCHING THE PRICE AGAIN" };
		case "machine.stopped":
			return { title: "STOPPED", detail: "WILL NOT ACT AGAIN" };
		case "machine.limits_changed":
			return { title: "LIMIT SET", detail: text(p["limit"]).toUpperCase() };
		case "run.queued":
			return { title: "WOKE UP", detail: text(p["wokeOn"]).toUpperCase() || "ON SCHEDULE" };
		case "run.skipped":
			// The reason reads "limit_reached: this machine already holds...", so the sentence after the colon.
			return {
				title: "DID NOTHING",
				detail: (text(p["detail"]).split(": ").pop() ?? "").toUpperCase(),
			};
		case "trade.intended":
			return { title: "DECIDED TO TRADE", detail: "ASKING FOR A SIGNATURE" };
		case "trade.completed":
			return {
				title: "TRADED",
				detail: `SPENT ${amount(text(p["inputAmount"]) || "0")} · GOT ${amount(text(p["outputAmount"]) || "0", 9)}`,
			};
		case "trade.simulated":
			return { title: "TRADED ON PAPER", detail: "NO MONEY MOVED" };
		case "trade.refused":
			return { title: "REFUSED", detail: text(p["reason"]).toUpperCase() };
		case "trade.failed":
			return { title: "TRADE FAILED", detail: text(p["reason"]).toUpperCase() };
		case "sweep.completed":
			return { title: "BANKED PROFIT", detail: "MOVED TO THE VAULT" };
		case "withdrawal.completed":
			return { title: "WITHDRAWN", detail: "SENT BACK TO THE OWNER" };
		default:
			return { title: entry.type.replace(".", " ").toUpperCase(), detail: "" };
	}
}
