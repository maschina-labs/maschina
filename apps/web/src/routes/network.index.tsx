import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Coordinates } from "../components/coordinates.tsx";
import { Globe } from "../components/globe.tsx";
import { useActivity } from "../components/portfolio.tsx";
import { Scramble } from "../components/scramble.tsx";
import { describeEvent } from "../lib/describe.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

export const Route = createFileRoute("/network/")({
	component: Page,
});

/** Where machines run. The globe first; the nodes on it come once the network reports where they are. */
function Page() {
	const [centre, setCentre] = useState({ lat: 18, lng: 0 });
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const mine = session.data ? (machines.data ?? []) : [];
	const log = useActivity().slice(0, 8);
	const figures: [string, string][] = [
		["NODES ONLINE", "-"],
		["MACHINES ON MASCHINA", "-"],
		[
			"YOURS RUNNING",
			`${mine.filter((machine) => machine.state === "running").length} OF ${mine.length}`,
		],
	];
	return (
		// Fits the screen exactly: the globe takes whatever height is left and never makes the page scroll.
		<div className="relative flex h-full w-full flex-col overflow-hidden px-2 py-6 sm:px-6 sm:py-10">
			<div className="flex items-start justify-between gap-6">
				<div className="flex flex-col gap-2">
					<Scramble text="NETWORK" className="text-[11px] text-neutral-500 tracking-[0.14em]" />
					<Scramble
						text="THE NETWORK, LIVE"
						className="text-[18px] text-neutral-100 tracking-[0.1em]"
					/>
				</div>
				<Coordinates target={centre} />
			</div>
			<div className="relative min-h-0 w-full flex-1">
				<Globe onView={setCentre} />
				{/* Floating over the globe, like the first Maschina's network page: figures left, a log right. */}
				<div className="pointer-events-none absolute top-6 left-0 hidden flex-col gap-6 md:flex">
					{figures.map(([label, value]) => (
						<div key={label} className="flex flex-col gap-1">
							<span className={LABEL}>{label}</span>
							<span className="text-[20px] text-neutral-100 tabular-nums">{value}</span>
						</div>
					))}
					<span className="max-w-[180px] text-[10px] text-neutral-600 leading-relaxed tracking-[0.1em]">
						NODES AND EVERY MACHINE ON MASCHINA ARRIVE WITH THE BACKEND PASS
					</span>
				</div>
				<ol
					aria-label="Network log"
					className="pointer-events-none absolute top-6 right-0 hidden w-60 flex-col gap-4 lg:flex"
				>
					{log.map((entry) => (
						<li key={entry.id} className="flex flex-col gap-1 text-[10.5px] tracking-[0.1em]">
							<span className="text-neutral-600 tabular-nums">
								{new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
							</span>
							<span className="text-neutral-200">{describeEvent(entry).title}</span>
							<span className="truncate text-neutral-500">{entry.machineName.toUpperCase()}</span>
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}
