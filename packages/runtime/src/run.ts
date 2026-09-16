/**
 * The loop every machine runs, whatever its kind. A run moves through these phases in this order and
 * no other. The world only changes between recording the intent and recording the outcome, so a crash
 * anywhere else leaves nothing to clean up.
 */

import { MaschinaError } from "@maschina/core";

export const RUN_PHASES = [
	"restore",
	"assemble",
	"decide",
	"authorize",
	"record_intent",
	"execute",
	"record_outcome",
	"assess",
] as const;

export type RunPhase = (typeof RUN_PHASES)[number];

/** A run may end early after deciding there is nothing to do, or after being refused. */
export type RunEnd = "finished" | "skipped" | "refused" | "failed";

const EARLY_EXITS: Partial<Record<RunPhase, RunEnd[]>> = {
	restore: ["failed"],
	assemble: ["failed"],
	decide: ["skipped", "failed"],
	authorize: ["refused", "failed"],
	record_intent: ["failed"],
	execute: ["failed"],
	record_outcome: ["failed"],
	assess: ["finished"],
};

/** The only phase allowed to come next. */
export function nextPhase(current: RunPhase): RunPhase | null {
	const index = RUN_PHASES.indexOf(current);
	return RUN_PHASES[index + 1] ?? null;
}

/** Throws unless moving from `from` to `to` is allowed. */
export function assertTransition(from: RunPhase, to: RunPhase | RunEnd): void {
	if (to === nextPhase(from)) return;
	if ((EARLY_EXITS[from] ?? []).includes(to as RunEnd)) return;
	throw new MaschinaError("conflict", `a run cannot go from ${from} to ${to}`);
}

/** True for the only phases in which the world may change. */
export function changesTheWorld(phase: RunPhase): boolean {
	return phase === "execute";
}
