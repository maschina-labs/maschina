/**
 * The root capability, and the emergency stop. `03-RUNTIME` §6, `12-SECURITY` §6.
 *
 * "A single action revokes the root capability. Every capability in the tree is
 * a descendant of it, so every worker loses all authority at once. Workers do
 * not need to cooperate, and the control plane does not need to reach them,
 * because they cannot act without authority."
 *
 * That sentence only works if the tree really is a tree. Before this file it was
 * not: every capability was granted with no parent, so there were as many roots
 * as capabilities, and revoking "the root" would have revoked exactly one of
 * them while every other worker carried on. The comments in `capability.ts`
 * asserted otherwise, which is worse than not having the feature, because it
 * reads as though the stop exists.
 *
 * **What the stop does not do.** It undoes nothing. A worker that already
 * deployed something has still deployed it. This stops future effects, and
 * pretending otherwise would be dishonest about what the system can offer
 * (`03-RUNTIME` §6).
 *
 * **Why it works without cooperation.** Authority is checked against the log at
 * every use and never cached (`05-CAPABILITIES` §4). A revoked ancestor fails
 * the check wherever the worker happens to be running, including on a machine
 * nobody can reach. P3 requiring checks at use is not a performance opinion; it
 * is the mechanism that makes the stop real.
 *
 * Custody is the known violation in `ADR-002`: at Stage 0 the root is a row in
 * the local database rather than an offline hardware-backed key. The structure
 * it exists to support is here; the custody is not.
 */

import type { Capability } from "@maschina/core";
import type { Pool } from "pg";
import { ensureRoot, foldCapability, grant, list, ROOT_HOLDER, revoke } from "./capability.ts";
import { append, read } from "./log.ts";

/** Written when somebody decides the system may run again, and says why. */
export const EMERGENCY_STOP_LIFTED = "emergency_stop.lifted";

/**
 * Revoke the root. Every capability in the tree goes with it.
 *
 * One call, no cooperation, no reachability. `revoke` already walks descendants
 * and `authorize` already refuses when any ancestor is revoked, so the whole
 * mechanism was present and had nothing to hang from.
 */
export async function emergencyStop(
	pool: Pool,
	actor: string,
	reason: string,
): Promise<string[]> {
	const root = await ensureRoot(pool);
	return revoke(pool, root.id, actor, `emergency stop: ${reason}`);
}

/**
 * Start again after a stop. Deliberately, and on the record.
 *
 * There is no way back from an emergency stop that does not go through here.
 * `ensureRoot` refuses to mint a new root while a revoked one exists, precisely
 * so that restarting cannot happen as a side effect of somebody granting a
 * capability and not thinking about it.
 *
 * Nothing revoked comes back. This creates a new root, so every capability that
 * existed before the stop stays dead and has to be granted again by whoever
 * decides it should exist. That is the point: a stop is not a pause.
 */
export async function liftEmergencyStop(
	pool: Pool,
	actor: string,
	reason: string,
): Promise<Capability> {
	const root = await grant(pool, {
		holder: ROOT_HOLDER,
		resource: "objective",
		operations: ["evaluate"],
		scope: "root",
		effectClass: "unsafe",
		checkpoint: "none",
		approval: "every_use",
		delegationDepth: 8,
		grantedBy: actor,
		parent: null,
	});

	await append(pool, {
		actor,
		type: EMERGENCY_STOP_LIFTED,
		payload: { v: 1, root: root.id, reason },
	});

	return root;
}

/**
 * Every capability that still grants anything.
 *
 * Used to check a stop actually stopped, rather than trusting that it did. Folds
 * each capability from the log and walks its ancestors, so a child whose own row
 * still says `active` is correctly reported as dead when its parent is revoked.
 */
export async function liveCapabilities(pool: Pool): Promise<Capability[]> {
	const all = await list(pool);
	const byId = new Map(all.map((c) => [c.id, c]));

	return all.filter((capability) => {
		if (capability.status !== "active") return false;
		let cursor = capability.parent;
		while (cursor !== null) {
			const ancestor = byId.get(cursor);
			if (ancestor === undefined || ancestor.status !== "active") return false;
			cursor = ancestor.parent;
		}
		return true;
	});
}

/** Rebuild one capability straight from the log, for checking a projection. */
export async function foldCapabilityFromLog(
	pool: Pool,
	capabilityId: string,
): Promise<Capability | null> {
	const events = (await read(pool)).filter((e) => e.payload.capabilityId === capabilityId);
	return foldCapability(events);
}
