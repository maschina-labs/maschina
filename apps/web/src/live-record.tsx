import { useEffect, useState } from "react";
import { API } from "./status.ts";

/** One finished trade, as the public API sends it. Amounts are whole base units as text. */
type Trade = { at: string; side: "buy" | "sell"; usdc: string; sol: string; signature: string };

type State = { state: "loading" } | { state: "down" } | { state: "ready"; trades: Trade[] };

/** How many of the latest trades the page shows. */
const SHOWN = 8;

const isTrade = (value: unknown): value is Trade => {
	if (typeof value !== "object" || value === null) return false;
	const trade = value as Record<string, unknown>;
	return (
		typeof trade["at"] === "string" &&
		!Number.isNaN(Date.parse(trade["at"])) &&
		(trade["side"] === "buy" || trade["side"] === "sell") &&
		typeof trade["usdc"] === "string" &&
		/^\d+$/.test(trade["usdc"]) &&
		typeof trade["sol"] === "string" &&
		/^\d+$/.test(trade["sol"]) &&
		typeof trade["signature"] === "string" &&
		trade["signature"].length > 0
	);
};

/** Reads the public record. Anything that is not a well formed trade is dropped, never shown. */
async function readRecord(get: typeof fetch = fetch): Promise<State> {
	try {
		const response = await get(`${API}/v1/public/record`, {
			headers: { accept: "application/json" },
		});
		if (!response.ok) return { state: "down" };
		const body = (await response.json()) as { trades?: unknown };
		if (!Array.isArray(body.trades)) return { state: "down" };
		return { state: "ready", trades: body.trades.filter(isTrade).slice(0, SHOWN) };
	} catch {
		return { state: "down" };
	}
}

/** Whole base units to a fixed number of decimals, in text, so no float rounds a real amount. */
function amount(units: string, decimals: number, shown: number): string {
	const padded = units.padStart(decimals + 1, "0");
	const whole = padded.slice(0, -decimals);
	const fraction = padded.slice(-decimals).slice(0, shown).padEnd(shown, "0");
	return `${whole}.${fraction}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 8, 18:49 UTC": the same for every reader, wherever they are. */
function when(iso: string): string {
	const date = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

const NOTE = "text-center text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug";

/**
 * The real trades of one live machine, read from the public record and shown newest first, each with a link to
 * its transaction on Solscan so a reader can check it. It shows what happened and nothing about how well: no
 * profit, no totals, no percentages. It never makes anything up: while it loads it says so, when there is
 * nothing it says that, and when the API cannot be reached it says that instead of showing a stale or invented
 * list. Times are in UTC so every reader sees the same thing.
 */
export function LiveRecord() {
	const [record, setRecord] = useState<State>({ state: "loading" });

	useEffect(() => {
		let live = true;
		void readRecord().then((next) => live && setRecord(next));
		return () => {
			live = false;
		};
	}, []);

	return (
		<section
			aria-label="Live record"
			className="relative flex flex-col items-center bg-black px-(--gutter) py-20 sm:py-32"
		>
			<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				Every trade, on the record.
			</h2>
			<p className={`mt-6 max-w-[48ch] ${NOTE}`}>
				Real trades on Solana, newest first. Each one links to its transaction.
			</p>
			{record.state === "ready" && record.trades.length > 0 ? (
				<ul className="mt-14 flex w-full max-w-3xl flex-col gap-2">
					{record.trades.map((trade) => (
						<li
							key={trade.signature}
							className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-white/[0.04] px-6 py-4 text-[15px] text-neutral-200"
						>
							<span className="w-full text-neutral-500 sm:w-36">{when(trade.at)}</span>
							<span className="text-white sm:w-16">{trade.side === "buy" ? "Bought" : "Sold"}</span>
							<span className="flex-1">
								{amount(trade.sol, 9, 4)} SOL for {amount(trade.usdc, 6, 2)} USDC
							</span>
							<a
								href={`https://solscan.io/tx/${trade.signature}`}
								target="_blank"
								rel="noopener noreferrer"
								className="w-full text-neutral-400 transition-colors hover:text-white sm:w-auto"
							>
								Solscan ↗
							</a>
						</li>
					))}
				</ul>
			) : (
				<p className={`mt-14 ${NOTE}`}>
					{record.state === "loading"
						? "Loading the record."
						: record.state === "down"
							? "The record could not be loaded right now."
							: "No trades to show yet."}
				</p>
			)}
		</section>
	);
}
