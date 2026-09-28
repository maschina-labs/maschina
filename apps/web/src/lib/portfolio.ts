import type { MachineSummary, RecordEntry } from "./machines.ts";

/** Everything across an owner's machines, in base units so nothing is lost to rounding on the way. */
export type Totals = {
	machines: number;
	running: number;
	/** The floats: what every machine was given to trade with, in USDC base units. */
	granted: bigint;
	/** Profit and loss taken so far, in USDC base units. Can be below zero. */
	realised: bigint;
	/** What is held between a buy and a sale, in SOL base units. */
	holding: bigint;
	trades: number;
	/** True when any of it is paper, so the numbers are not money. */
	simulated: boolean;
};

export function totalsOf(machines: MachineSummary[]): Totals {
	return machines.reduce<Totals>(
		(sum, machine) => ({
			machines: sum.machines + 1,
			running: sum.running + (machine.state === "running" ? 1 : 0),
			granted: sum.granted + BigInt(machine.budget.granted),
			realised: sum.realised + BigInt(machine.result.realised),
			holding: sum.holding + BigInt(machine.result.position),
			trades: sum.trades + machine.result.trades,
			simulated: sum.simulated || machine.result.simulated,
		}),
		{
			machines: 0,
			running: 0,
			granted: 0n,
			realised: 0n,
			holding: 0n,
			trades: 0,
			simulated: false,
		},
	);
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
