/**
 * Everything every machine has done, in one column.
 *
 * Built by reading each machine's record and merging them, newest first, because the record is per
 * machine and there is no route that spans them yet. That is honest about where the data comes from and
 * it costs one request per machine, which is fine for the number of machines a person owns and would not
 * be for a thousand. When a cross-machine route exists this screen changes its source and nothing else.
 *
 * Nothing here is generated. Every line is an event the record actually holds.
 */

import { Funnel, Pulse, Wallet } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ForError } from "../components/for-error.tsx";
import { Shell } from "../components/shell.tsx";
import { Button, Empty, Loading, PageHead, Payload, Pill } from "../components/ui.tsx";
import { type RecordEntry, recordQueryFor, useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

export const Route = createFileRoute("/activity")({
	component: Activity,
});

type Line = RecordEntry & { machineId: string; machineName: string };

/** Which events are worth a colour, and which are the background noise of a healthy machine. */
const LOUD = new Set([
	"trade.intended",
	"trade.simulated",
	"trade.submitted",
	"trade.completed",
	"withdrawal.completed",
]);
const BAD = new Set(["trade.refused", "trade.failed", "withdrawal.failed", "machine.paused"]);

const when = (at: string) =>
	new Date(at).toLocaleString([], {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

function ActivityLine({ line }: { line: Line }) {
	const colour = LOUD.has(line.type)
		? "text-accent-text"
		: BAD.has(line.type)
			? "text-danger-text"
			: "text-text-faint";

	return (
		<li className="flex gap-4 border-line/50 border-b px-7 py-2.5 last:border-0">
			<span className="w-[132px] shrink-0 pt-[1px] font-mono text-[11px] text-text-faint">
				{when(line.occurredAt)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex flex-wrap items-baseline gap-x-2">
					<span className={`font-mono text-[12px] ${colour}`}>{line.type}</span>
					<Link
						to="/machines/$machineId"
						params={{ machineId: line.machineId }}
						className="truncate text-[12px] text-text-muted underline-offset-2 hover:text-text hover:underline"
					>
						{line.machineName}
					</Link>
				</span>
				<Payload value={line.payload} />
			</span>
		</li>
	);
}

function Activity() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const [tradesOnly, setTradesOnly] = useState(false);

	// One read per machine. `useQueries` keeps them independent, so one slow machine does not hold up
	// the rest of the feed.
	const records = useQueries({
		queries: (machines.data ?? []).map((machine) => recordQueryFor(api, machine.machineId)),
	});

	const lines: Line[] = (machines.data ?? [])
		.flatMap((machine, index) =>
			(records[index]?.data ?? []).map((entry) => ({
				...entry,
				machineId: machine.machineId,
				machineName: machine.name,
			})),
		)
		.filter((line) => !tradesOnly || line.type.startsWith("trade."))
		.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

	const reading = machines.isPending || records.some((record) => record.isPending);
	const broke = machines.error ?? records.find((record) => record.error)?.error;

	return (
		<Shell>
			<PageHead
				title="Activity"
				note="Every run and every trade, across every machine you own, newest first."
				actions={
					<Button
						icon={Funnel}
						tone={tradesOnly ? "primary" : "outline"}
						onClick={() => setTradesOnly(!tradesOnly)}
					>
						Trades only
					</Button>
				}
			>
				{lines.length > 0 ? (
					<div className="mt-2 flex items-center gap-2">
						<Pill tone="quiet">{`${lines.length} events`}</Pill>
						<Pill tone="quiet">{`${machines.data?.length ?? 0} machines`}</Pill>
					</div>
				) : null}
			</PageHead>

			{!session.data ? (
				<Empty
					icon={Wallet}
					title="Connect a wallet to see what your machines have done"
					note="The record is per owner. Nothing about a machine is readable by anybody but the wallet that made it."
				/>
			) : broke ? (
				<ForError
					error={broke}
					title="The record could not be read"
					retry={() => machines.refetch()}
				/>
			) : reading ? (
				<Loading rows={8} />
			) : lines.length === 0 ? (
				<Empty
					icon={Pulse}
					title={tradesOnly ? "No trades yet" : "Nothing has happened yet"}
					note={
						tradesOnly
							? "Your machines have run, but none of them has traded. A machine that waits is a machine working correctly."
							: "Once a machine is started, every run it takes and every trade it makes appears here as it happens."
					}
					action={
						tradesOnly ? (
							<Button onClick={() => setTradesOnly(false)}>Show everything</Button>
						) : null
					}
				/>
			) : (
				<ul className="mx-auto w-full max-w-[1180px]">
					{lines.map((line) => (
						<ActivityLine key={line.id} line={line} />
					))}
				</ul>
			)}
		</Shell>
	);
}
