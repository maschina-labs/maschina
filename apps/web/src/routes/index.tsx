import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { bandOf, useMachineAtWork, WorkBar } from "../components/at-work.tsx";
import { BandDial } from "../components/band-dial.tsx";
import { BandRuler } from "../components/band-ruler.tsx";
import { DecisionLog } from "../components/decision-log.tsx";
import { FirstRun } from "../components/first-run.tsx";
import { FleetStrip } from "../components/fleet-strip.tsx";
import { Fullscreen } from "../components/fullscreen.tsx";
import { MarketStrip } from "../components/market-strip.tsx";
import { useMachineTrades } from "../components/portfolio.tsx";
import { PriceChart } from "../components/price-chart.tsx";
import { SolPrice } from "../components/sol-price.tsx";
import { MachineTapeView, MarketTape } from "../components/tapes.tsx";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { tradesFrom } from "../lib/trades.ts";

export const Route = createFileRoute("/")({
	component: Terminal,
	// Which machine to follow, when one has been chosen from the sidebar.
	validateSearch: (search: Record<string, unknown>): { machine?: string } =>
		typeof search["machine"] === "string" ? { machine: search["machine"] } : {},
});

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

/** The market, the machine working it, and what it last decided. */
function Terminal() {
	const { machine: chosen } = Route.useSearch();
	const { machine, record } = useMachineAtWork(chosen);
	const machineTrades = useMachineTrades();
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	// Nothing shows until the session is known, so a returning owner never sees the first run flash past.
	const known = !session.isPending && (!session.data || machines.data !== undefined);
	const [interval, setInterval] = useState<Interval>("15m");
	const [price, setPrice] = useState<number>();
	const band = machine ? bandOf(machine, record) : [];
	const sell = band.find((level) => level.label === "SELL")?.price;
	const buy = band.find((level) => level.label === "BUY")?.price;
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			{known ? (
				<FirstRun
					connected={Boolean(session.data)}
					hasMachine={(machines.data?.length ?? 0) > 0 && Boolean(session.data)}
				/>
			) : null}
			{known && !session.data ? (
				<section aria-label="Public activity" className="flex flex-col gap-2">
					<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">
						{"PUBLIC // EVERY MACHINE, LIVE"}
					</h2>
					<p className="text-[10.5px] text-neutral-600 tracking-[0.1em]">
						EVERY PUBLIC MACHINE'S TRADES AND REFUSALS, WATCHABLE WITHOUT CONNECTING, ARRIVE WITH
						THE BACKEND PASS. THE MARKET BELOW IS LIVE NOW.
					</p>
				</section>
			) : null}
			<FleetStrip
				machines={session.data ? (machines.data ?? []) : []}
				following={machine?.machineId}
			/>
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
				<div className="flex min-h-0 flex-1 gap-4">
					{/* The instrument: the machine's band as a dial, the live price at its centre. */}
					{buy !== undefined && sell !== undefined ? (
						<div className="hidden aspect-square h-full max-h-[340px] shrink-0 self-center xl:block">
							<BandDial buy={buy} sell={sell} price={price} />
						</div>
					) : null}
					<div className="min-w-0 flex-1">
						<Fullscreen label="Chart">
							<PriceChart
								interval={interval}
								levels={band}
								trades={tradesFrom(record)}
								onPrice={setPrice}
							/>
						</Fullscreen>
					</div>
					{buy !== undefined && sell !== undefined ? (
						<div className="hidden sm:block">
							<BandRuler buy={buy} sell={sell} price={price} />
						</div>
					) : null}
				</div>
			</section>
			<WorkBar machine={machine} record={record} />
			<DecisionLog record={record} />
			<div className="grid gap-10 pt-4 md:grid-cols-2">
				<MachineTapeView trades={machineTrades} />
				<MarketTape />
			</div>
		</div>
	);
}
