/**
 * The towers background, after the PlayStation 2's boot screen, where every tower was a save on the memory
 * card. Here every tower is one of your machines: taller the more it has done, glowing while it runs,
 * dim when paused, faint when stopped, and see through on paper. With no machines, a few low ones wait.
 */

import { useRouter } from "@tanstack/react-router";
import { type MachineSummary, useMachines } from "./machines.ts";
import { useSession } from "./session.ts";
import { useSide } from "./side.ts";

export type Tower = { height: number; glow: number };

/** The most towers drawn: the shader reads twelve. */
export const MAX_TOWERS = 12;

/** What stands in the fog before there are any machines: low, quiet, a little uneven. */
export const AMBIENT: Tower[] = [0.22, 0.14, 0.3, 0.18, 0.26, 0.12].map((height) => ({
	height,
	glow: 0.22,
}));

const GLOW: Record<string, number> = {
	running: 1,
	ready: 0.6,
	paused: 0.5,
	draft: 0.35,
	stopped: 0.22,
};

export function towersFrom(
	machines: Pick<MachineSummary, "state" | "paper" | "result">[],
): Tower[] {
	if (machines.length === 0) return AMBIENT;
	const busiest = [...machines]
		.sort((a, b) => b.result.trades - a.result.trades)
		.slice(0, MAX_TOWERS);
	const most = Math.log1p(busiest[0]?.result.trades ?? 0) || 1;
	return busiest.map((machine) => ({
		// Never flat: even a machine that has not traded yet stands a little way up.
		height: Math.max(0.18, Math.log1p(machine.result.trades) / most),
		glow: (GLOW[machine.state] ?? 0.3) * (machine.paper ? 0.55 : 1),
	}));
}

/** Your machines as towers, on the side of the money being shown: live ones, or paper ones. */
export function useTowers(): Tower[] {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const side = useSide();
	const mine = session.data ? (machines.data ?? []) : [];
	return towersFrom(mine.filter((machine) => Boolean(machine.paper) === (side === "paper")));
}
