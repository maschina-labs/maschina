import type { MachineSummary, RecordEntry } from "./machines.ts";

/** Live money, or paper: a sandbox on live markets whose numbers are never money (D-096). */
export type Side = "live" | "paper";

/** Whether a machine is on paper: its own flag, or, from an older API, its result saying so. */
export const onPaper = (machine: MachineSummary) => machine.paper ?? machine.result.simulated;

/**
 * One side's machines added up, in base units so nothing is lost to rounding. Paper and live are never
 * added together: asking for live counts only live machines, asking for paper only paper ones.
 */
export type Totals = {
	machines: number;
	running: number;
	/** What the machines that can still act were given to trade with, in USDC base units. */
	granted: bigint;
	/** Profit and loss taken so far by every machine on this side, stopped ones too. Can be below zero. */
	realized: bigint;
	/** What the machines that can still act hold between a buy and a sale, in SOL base units. */
	holding: bigint;
	trades: number;
};

export function totalsOf(machines: MachineSummary[], side: Side = "live"): Totals {
	const zero: Totals = {
		machines: 0,
		running: 0,
		granted: 0n,
		realized: 0n,
		holding: 0n,
		trades: 0,
	};
	return machines
		.filter((machine) => onPaper(machine) === (side === "paper"))
		.reduce<Totals>((sum, machine) => {
			// A stopped machine never acts again: its budget and holding are history, not money at work.
			const atWork = machine.state !== "stopped";
			return {
				machines: sum.machines + 1,
				running: sum.running + (machine.state === "running" ? 1 : 0),
				granted: sum.granted + (atWork ? BigInt(machine.budget.granted) : 0n),
				realized: sum.realized + BigInt(machine.result.realised),
				holding: sum.holding + (atWork ? BigInt(machine.result.position) : 0n),
				trades: sum.trades + machine.result.trades,
			};
		}, zero);
}

export type ActivityEntry = RecordEntry & { machineId: string; machineName: string };

/** Every machine's record as one feed, newest first. */
export function activityOf(
	records: { machine: MachineSummary; events: RecordEntry[] }[],
	limit = 50,
): ActivityEntry[] {
	return records
		.flatMap(({ machine, events }) =>
			events.map((event) => ({
				...event,
				machineId: machine.machineId,
				machineName: machine.name,
			})),
		)
		.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
		.slice(0, limit);
}
