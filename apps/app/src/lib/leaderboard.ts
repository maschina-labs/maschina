import type { MachineSummary, RecordEntry } from "./machines.ts";
import { realizedSteps } from "./pnl.ts";

/** How far back the board looks. */
const WINDOWS = {
	"1D": 86_400_000,
	"1W": 604_800_000,
	ALL: Number.POSITIVE_INFINITY,
} as const;
export type Window = keyof typeof WINDOWS;

export type Standing = {
	machineId: string;
	name: string;
	kind: string;
	realised: bigint;
	paper: boolean;
};

/**
 * Machines ranked by what they realized within the window, best first: each sale's profit counted when it
 * happened. Paper and real money are kept apart by the caller, never mixed on one board.
 */
export function standings(
	machines: { machine: MachineSummary; record: RecordEntry[] }[],
	window: Window,
	now: number = Date.now(),
): Standing[] {
	const since = now - WINDOWS[window];
	return machines
		.map(({ machine, record }) => {
			let before = 0n;
			let within = 0n;
			for (const step of realizedSteps(record)) {
				if (step.time * 1000 >= since) within += step.value - before;
				before = step.value;
			}
			return {
				machineId: machine.machineId,
				name: machine.name,
				kind: machine.kind,
				realised: within,
				paper: machine.result.simulated,
			};
		})
		.sort((a, b) => (b.realised > a.realised ? 1 : b.realised < a.realised ? -1 : 0));
}
