import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { MachineChat } from "../components/chat-panel.tsx";
import { MachinePanel } from "../components/machine-panel.tsx";
import { byDay, filterActivity, KINDS, type Kind } from "../lib/activity-filter.ts";
import { describeEvent } from "../lib/describe.ts";
import { useMachine, useRecord } from "../lib/machines.ts";
import { recordCsv } from "../lib/track-record.ts";

const TABS = ["overview", "record", "chat"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/machines/$machineId")({
	component: Page,
	validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
		TABS.includes(search["tab"] as Tab) ? { tab: search["tab"] as Tab } : {},
});

/** One machine, in three tabs: its instrument, its whole record, and talking to it. */
function Page() {
	const { machineId } = Route.useParams();
	const { tab = "overview" } = Route.useSearch();
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<nav aria-label="Machine" className="flex gap-6 text-[11px] tracking-[0.14em]">
				{TABS.map((each) => (
					<Link
						key={each}
						to="/machines/$machineId"
						params={{ machineId }}
						search={{ tab: each }}
						className={
							tab === each ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
						}
					>
						{each.toUpperCase()}
					</Link>
				))}
			</nav>
			{tab === "overview" ? (
				<MachinePanel machineId={machineId} />
			) : tab === "record" ? (
				<WholeRecord machineId={machineId} />
			) : (
				<Chat machineId={machineId} />
			)}
		</div>
	);
}

/** Every event, filterable, by day, and downloadable for tax and accounting (#479). */
function WholeRecord({ machineId }: { machineId: string }) {
	const { api } = useRouter().options.context;
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const [kind, setKind] = useState<Kind>("ALL");
	const events = (record.data ?? []).map((entry) => ({
		...entry,
		machineId,
		machineName: machine.data?.name ?? "",
	}));
	const days = byDay(filterActivity([...events].reverse(), kind));
	const download = () => {
		const blob = new Blob([recordCsv(record.data ?? [])], { type: "text/csv" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `${(machine.data?.name ?? "machine").replaceAll(" ", "-").toLowerCase()}-record.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	};
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset className="flex gap-1.5">
					<legend className="sr-only">Show</legend>
					{KINDS.map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={kind === each}
							onClick={() => setKind(each)}
							className={`border px-2.5 py-1.5 text-[10.5px] tracking-[0.12em] ${kind === each ? "border-white/40 text-neutral-100" : "border-white/10 text-neutral-500"}`}
						>
							{each}
						</button>
					))}
				</fieldset>
				<button
					type="button"
					onClick={download}
					className="border border-white/25 px-3 py-1.5 text-[10.5px] text-neutral-100 tracking-[0.12em] hover:bg-white/[0.06]"
				>
					EXPORT CSV
				</button>
			</div>
			{days.map(({ day, entries }) => (
				<section key={day} aria-label={day} className="flex flex-col gap-2">
					<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">{day}</h2>
					<ol>
						{entries.map((entry) => {
							const said = describeEvent(entry);
							return (
								<li
									key={entry.id}
									className="grid grid-cols-[auto_auto_1fr] gap-5 border-white/[0.06] border-b py-2 text-[11px] tracking-[0.1em]"
								>
									<time className="text-neutral-500 tabular-nums">
										{new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
									</time>
									<span className="text-neutral-100">{said.title}</span>
									<span className="truncate text-neutral-500">{said.detail}</span>
								</li>
							);
						})}
					</ol>
				</section>
			))}
		</div>
	);
}

function Chat({ machineId }: { machineId: string }) {
	const { api } = useRouter().options.context;
	const machine = useMachine(api, machineId);
	return machine.data ? (
		<div className="max-w-[640px]">
			<MachineChat machine={machine.data} />
		</div>
	) : null;
}
