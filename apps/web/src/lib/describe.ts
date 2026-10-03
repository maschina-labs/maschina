import { amount, type RecordEntry } from "./machines.ts";

/**
 * What a record entry means, in words a person reads: a short title and one line of detail. The record
 * itself stays exact; this is only how it is said on screen.
 */
export type Described = { title: string; detail: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const TOKENS: Record<string, { symbol: string; decimals: number; places: number }> = {
	EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6, places: 2 },
	So11111111111111111111111111111111111111112: { symbol: "SOL", decimals: 9, places: 4 },
};

/**
 * A completed trade records how much went each way, not which tokens: those are on its intent, written
 * just before. This copies them across, so a sale reads as a sale and each amount is in its own token.
 */
export function withTradeMints(events: RecordEntry[]): RecordEntry[] {
	const mints = new Map<string, { inputMint: unknown; outputMint: unknown }>();
	for (const event of events)
		if (event.type === "trade.intended") {
			const p = event.payload as Record<string, unknown>;
			mints.set(String(p["tradeId"]), { inputMint: p["inputMint"], outputMint: p["outputMint"] });
		}
	return events.map((event) => {
		if (event.type !== "trade.completed") return event;
		const p = event.payload as Record<string, unknown>;
		const found = mints.get(String(p["tradeId"]));
		return found && !p["inputMint"] ? { ...event, payload: { ...p, ...found } } : event;
	});
}

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
		case "machine.recentred": {
			// The price is in micro-dollars.
			const at = `$${(Number(text(p["price"])) / 1_000_000).toFixed(2)}`;
			return p["because"] === "followed"
				? { title: "BAND MOVED", detail: `FOLLOWED THE PRICE TO ${at}` }
				: { title: "BAND SET", detail: `AROUND ${at}` };
		}
		case "machine.retuned":
			return { title: "RECIPE CHANGED", detail: "RUNS A NEW RECIPE FROM HERE" };
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
		case "trade.completed": {
			// Which way it went comes from the trade's intent (see withTradeMints). Without it, the old wording.
			const input = TOKENS[text(p["inputMint"])];
			const output = TOKENS[text(p["outputMint"])];
			if (input && output) {
				const spent = `${amount(text(p["inputAmount"]) || "0", input.decimals, input.places)} ${input.symbol}`;
				const got = `${amount(text(p["outputAmount"]) || "0", output.decimals, output.places)} ${output.symbol}`;
				return {
					title: input.symbol === "USDC" ? "BOUGHT" : "SOLD",
					detail: `${spent} · GOT ${got}`,
				};
			}
			return {
				title: "TRADED",
				detail: `SPENT ${amount(text(p["inputAmount"]) || "0")} · GOT ${amount(text(p["outputAmount"]) || "0", 9)}`,
			};
		}
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
