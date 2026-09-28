import { useEffect, useState } from "react";
import { type Print, streamPrints } from "../lib/tape.ts";
import type { Trade } from "../lib/trades.ts";

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";
const ROW = "grid grid-cols-[auto_1fr_auto] gap-4 py-1 text-[11px] tabular-nums tracking-[0.06em]";
const clock = (at: number) => new Date(at).toLocaleTimeString("en-CA", { hour12: false });

export function MarketTapeView({ prints }: { prints: Print[] }) {
	return (
		<section aria-label="Market trades" className="flex flex-col gap-2">
			<h2 className={LABEL}>MARKET TRADES</h2>
			<ol>
				{prints.map((print) => (
					<li key={print.id} className={ROW}>
						<span className="text-neutral-600">{clock(print.at)}</span>
						<span className="text-neutral-100">
							<span className="mr-2 text-[9px]">{print.side === "buy" ? "▲" : "▼"}</span>
							{print.price.toFixed(2)}
						</span>
						<span className="text-right text-neutral-500">{print.size.toFixed(2)} SOL</span>
					</li>
				))}
			</ol>
		</section>
	);
}

/** The last twenty trades in SOL, streaming. */
export function MarketTape() {
	const [prints, setPrints] = useState<Print[]>([]);
	useEffect(
		() => streamPrints("SOLUSDT", (print) => setPrints((was) => [print, ...was].slice(0, 20))),
		[],
	);
	return <MarketTapeView prints={prints} />;
}

/**
 * Machines' own trades, newest first. Yours for now; every machine on Maschina, anonymous, once the
 * backend streams them. Machines are named by kind and a short id, never by owner.
 */
export function MachineTapeView({ trades }: { trades: (Trade & { machine: string })[] }) {
	return (
		<section aria-label="Machine trades" className="flex flex-col gap-2">
			<h2 className={LABEL}>MACHINE TRADES</h2>
			{trades.length === 0 ? (
				<p className="text-[11px] text-neutral-600 tracking-[0.1em]">NONE YET</p>
			) : null}
			<ol>
				{trades.map((trade) => (
					<li key={`${trade.machine}${trade.at}`} className={ROW}>
						<span className="text-neutral-600">{clock(trade.at)}</span>
						<span className="truncate text-neutral-100">
							{trade.machine} · {trade.side === "buy" ? "BOUGHT" : "SOLD"}
						</span>
						<span className="text-right text-neutral-400">AT {trade.price.toFixed(2)}</span>
					</li>
				))}
			</ol>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				YOUR MACHINES FOR NOW · EVERY MACHINE ON MASCHINA WITH THE BACKEND PASS
			</p>
		</section>
	);
}
