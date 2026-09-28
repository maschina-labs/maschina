import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Dossier } from "../components/dossier.tsx";
import { useOperatingPicture } from "../components/portfolio.tsx";
import { briefOn } from "../lib/analyst.ts";
import { describeEvent } from "../lib/describe.ts";
import { buildGraph, type Node } from "../lib/intel.ts";
import { fetchPrice } from "../lib/price.ts";
import { useSession } from "../lib/session.ts";

export const Route = createFileRoute("/intel")({
	component: Page,
});

const LABEL = "text-[9.5px] text-neutral-500 tracking-[0.16em]";
const GROUPS: [Node["kind"], string][] = [
	["wallet", "WALLETS"],
	["machine", "MACHINES"],
	["vault", "VAULTS"],
	["token", "TOKENS"],
];

/**
 * The operating picture: every object Maschina knows about and the paths money takes between them, with a
 * dossier and the analyst's brief on whatever is selected, and every event on one timeline.
 */
function Page() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const picture = useOperatingPicture();
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const graph = buildGraph(session.data?.walletAddress, picture);
	const [selected, setSelected] = useState<string>("owner");
	const node = graph.nodes.find((each) => each.id === selected);
	const chosen = picture.find((each) => each.machine.machineId === node?.machineId);
	const events = chosen?.record ?? [];
	const brief =
		chosen && node?.kind === "machine"
			? briefOn(chosen.machine, chosen.record, price.data?.usd)
			: [];
	const timeline = picture
		.flatMap(({ machine, record }) =>
			record.map((entry) => ({ entry, machineId: machine.machineId })),
		)
		.sort((a, b) => a.entry.occurredAt.localeCompare(b.entry.occurredAt));
	const first = timeline[0] ? Date.parse(timeline[0].entry.occurredAt) : 0;
	const last = timeline.at(-1) ? Date.parse(timeline.at(-1)?.entry.occurredAt ?? "") : 1;
	const [hovered, setHovered] = useState<string>();

	if (!session.data)
		return <p className={`px-6 pt-10 ${LABEL}`}>CONNECT TO SEE YOUR OPERATING PICTURE</p>;
	return (
		<div className="flex h-full w-full flex-col gap-4 px-2 pt-6 pb-4 sm:px-6">
			<header className="flex items-baseline justify-between gap-4">
				<h1 className="text-[11px] text-neutral-500 tracking-[0.16em]">
					{"INTEL // OPERATING PICTURE"}
				</h1>
				<span className={LABEL}>
					{graph.nodes.length} OBJECTS · {graph.links.length} LINKS · {timeline.length} EVENTS
				</span>
			</header>
			<div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[180px_1fr]">
				<nav aria-label="Objects" className="hidden flex-col gap-5 overflow-y-auto lg:flex">
					{GROUPS.map(([kind, title]) => (
						<section key={kind} className="flex flex-col gap-1.5">
							<span className={LABEL}>{title}</span>
							{graph.nodes
								.filter((each) => each.kind === kind)
								.map((each) => (
									<button
										key={each.id}
										type="button"
										aria-pressed={each.id === selected}
										onClick={() => setSelected(each.id)}
										className={`flex justify-between gap-2 text-left text-[10.5px] tracking-[0.1em] ${each.id === selected ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
									>
										<span className="truncate">{each.label}</span>
										<span className="shrink-0 text-neutral-600">{each.code}</span>
									</button>
								))}
						</section>
					))}
				</nav>
				<div className="overflow-y-auto">
					<Dossier node={node} graph={graph} events={events} brief={brief} onSelect={setSelected} />
				</div>
			</div>
			{/* Every event on one line of time. Hover to read it, press to open its machine. */}
			<section aria-label="Timeline" className="flex flex-col gap-1.5">
				<div className="flex justify-between">
					<span className={LABEL}>TIMELINE</span>
					<span className={`${LABEL} text-neutral-400`}>
						{hovered ?? (timeline.length ? "HOVER AN EVENT" : "NOTHING YET")}
					</span>
				</div>
				<div className="relative h-8">
					<div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
					{timeline.map(({ entry, machineId }) => {
						const along =
							last > first ? (Date.parse(entry.occurredAt) - first) / (last - first) : 0.5;
						const trade = entry.type === "trade.completed";
						return (
							<button
								key={entry.id}
								type="button"
								aria-label={describeEvent(entry).title}
								onMouseEnter={() =>
									setHovered(
										`${new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })} · ${describeEvent(entry).title}`,
									)
								}
								onMouseLeave={() => setHovered(undefined)}
								onClick={() => setSelected(`m:${machineId}`)}
								className="absolute top-0 h-full w-1.5 -translate-x-1/2"
								style={{ left: `${along * 100}%` }}
							>
								<span
									className={`mx-auto block w-px ${trade ? "h-full bg-neutral-100" : "h-3 bg-white/35"}`}
								/>
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);
}
