import { useRouter } from "@tanstack/react-router";
import { describeEvent } from "../lib/describe.ts";
import {
	amount,
	type MachineDetail,
	type RecordEntry,
	useMachine,
	useMachines,
	useRecord,
} from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { bandOf, statusOf } from "../lib/status.ts";
import { GLASS } from "./glass.ts";

/**
 * The machine at work on the terminal: a glass bar saying what it is doing, and its last few decisions as
 * text floating on the fog, in the columns of Ash's reference.
 */

export function WorkBar({ machine }: { machine: MachineDetail | undefined }) {
	return (
		<div className={`flex h-11 items-center gap-6 px-4 text-[11px] tracking-[0.12em] ${GLASS}`}>
			{machine ? (
				<>
					<span className="text-neutral-100">{machine.name.toUpperCase()}</span>
					<span className="h-px flex-1 bg-white/15" aria-hidden="true" />
					<span className="text-neutral-300">{statusOf(machine)}</span>
					<span className="hidden text-neutral-500 tabular-nums sm:inline">
						FLOAT {amount(machine.budget.granted)} USDC
					</span>
					<span className="hidden text-neutral-500 tabular-nums sm:inline">
						{machine.result.trades} TRADES
					</span>
				</>
			) : (
				<span className="text-neutral-500">CONNECT TO SEE YOUR MACHINE AT WORK</span>
			)}
		</div>
	);
}

export function Decisions({ record }: { record: RecordEntry[] }) {
	const latest = [...record].reverse().slice(0, 3);
	if (latest.length === 0) return null;
	return (
		<ol aria-label="Latest decisions" className="grid grid-cols-1 gap-8 sm:grid-cols-3">
			{latest.map((entry) => {
				const said = describeEvent(entry);
				return (
					<li key={entry.id} className="flex flex-col gap-2 text-[11px] tracking-[0.1em]">
						<time className="text-neutral-500 tabular-nums" dateTime={entry.occurredAt}>
							{new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
						</time>
						<span className="text-neutral-100">{said.title}</span>
						{said.detail ? <span className="text-neutral-500">{said.detail}</span> : null}
					</li>
				);
			})}
		</ol>
	);
}

/** The machine the terminal follows: the first one running, or the first one at all. */
export function useMachineAtWork() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const list = session.data ? (machines.data ?? []) : [];
	const pick = list.find((machine) => machine.state === "running") ?? list[0];
	// With nothing to follow the id is empty, and the queries wait rather than ask.
	const detail = useMachine(api, pick?.machineId ?? "");
	const record = useRecord(api, pick?.machineId ?? "");
	return pick
		? { machine: detail.data, record: record.data ?? [] }
		: { machine: undefined, record: [] };
}

export { bandOf };
