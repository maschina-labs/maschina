import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { bandOf, Decisions, useMachineAtWork, WorkBar } from "../components/at-work.tsx";
import { MarketStrip } from "../components/market-strip.tsx";
import { PriceChart } from "../components/price-chart.tsx";
import { SolPrice } from "../components/sol-price.tsx";

export const Route = createFileRoute("/")({
	component: Terminal,
});

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

/** The market, the machine working it, and what it last decided. */
function Terminal() {
	const { machine, record } = useMachineAtWork();
	const [interval, setInterval] = useState<Interval>("15m");
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<section aria-label="SOL price" className="flex h-[60vh] min-h-[360px] flex-col gap-4">
				<SolPrice />
				<MarketStrip />
				<fieldset className="flex gap-4 text-[10.5px] tracking-[0.14em]">
					<legend className="sr-only">Interval</legend>
					{INTERVALS.map((each) => (
						<button
							key={each}
							type="button"
							onClick={() => setInterval(each)}
							aria-pressed={each === interval}
							className={
								each === interval ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
							}
						>
							{each.toUpperCase()}
						</button>
					))}
				</fieldset>
				<div className="min-h-0 flex-1">
					<PriceChart interval={interval} levels={machine ? bandOf(machine) : []} />
				</div>
			</section>
			<WorkBar machine={machine} />
			<Decisions record={record} />
		</div>
	);
}
