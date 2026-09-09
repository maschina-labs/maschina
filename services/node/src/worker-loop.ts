/**
 * What a worker does with an objective.
 *
 * Separate from the daemon on purpose. The daemon schedules; this decides. A
 * daemon that also decided would be the place logic hides from the log, and
 * `04-WORKERS` §4 has no room for a worker type that behaves differently because
 * of where it runs.
 *
 * Stage 1 slice 1 keeps this deliberately thin: take the objective, read its
 * contract, and suspend saying what it would need. The loop that actually
 * decides and acts arrives with concurrency and memory, in slices 4 and 5. What
 * this slice proves is that something stays running and picks work up, which is
 * the part that did not exist at all.
 */

import type { ControlPlane } from "@maschina/worker";

export async function runObjective(objective: string, plane: ControlPlane): Promise<void> {
	// Recorded before anything else, because a worker taking an objective is a
	// fact worth keeping even when what follows is "and then it stopped".
	await plane.append({
		actor: "worker:local",
		objective,
		type: "worker.took_objective",
		payload: { v: 1, objective },
	});

	// Nothing is granted to this worker yet, and inventing authority is the one
	// thing that must never happen (`01-PRINCIPLES` P1). So it says so and stops,
	// which is a legitimate outcome rather than a failure.
	await plane.append({
		actor: "worker:local",
		objective,
		type: "worker.suspended",
		payload: {
			v: 1,
			objective,
			reason: "no capabilities are held for this objective",
			question: "which capabilities should this worker hold, and over what?",
		},
	});
}
