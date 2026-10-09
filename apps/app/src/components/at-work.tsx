import { useRouter } from "@tanstack/react-router";
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

export function WorkBar({
	machine,
	record = [],
}: {
	machine: MachineDetail | undefined;
	record?: RecordEntry[];
}) {
	return (
		<div className={`flex h-11 items-center gap-6 px-4 text-[11px] tracking-[0.12em] ${GLASS}`}>
			{machine ? (
				<>
					<span className="text-neutral-100">{machine.name.toUpperCase()}</span>
					<span className="h-px flex-1 bg-white/15" aria-hidden="true" />
					<span className="text-neutral-300">{statusOf(machine, record)}</span>
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

/** The machine the terminal follows: the one chosen, else the first running, else the first at all. */
export function useMachineAtWork(chosen?: string) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const list = session.data ? (machines.data ?? []) : [];
	const pick =
		list.find((machine) => machine.machineId === chosen) ??
		list.find((machine) => machine.state === "running") ??
		list[0];
	// With nothing to follow the id is empty, and the queries wait rather than ask.
	const detail = useMachine(api, pick?.machineId ?? "");
	const record = useRecord(api, pick?.machineId ?? "");
	return pick
		? { machine: detail.data, record: record.data ?? [] }
		: { machine: undefined, record: [] };
}

export { bandOf };
