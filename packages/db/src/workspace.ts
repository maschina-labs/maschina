/**
 * Workspaces, and what happens to them when a node dies.
 * `15-OPEN-QUESTIONS` §3 C1, and open question 7.
 *
 * `03-RUNTIME` §2 requires a worker to hold no durable state between steps, and
 * `06-NODES` §6 concludes from that migration is free. A code worker breaks both
 * the moment it has a git working tree with uncommitted edits, because that
 * state exists nowhere in the log and migration would lose it silently.
 *
 * **The resolution is not to rescue the tree during recovery.** That was the
 * obvious design and it does not work: the tree is on the dead node's disk and
 * recovery runs somewhere else, so by the time anybody wants those edits the
 * machine holding them is gone. A checkpoint procedure that only fires at
 * recovery works exactly in the case that did not need it.
 *
 * So a capability declaring `checkpoint: "commit"` checkpoints **as it works**.
 * Each unit of progress is committed and pushed, and the commit hash goes in the
 * log, so the work is never only on the node. Recovery then does not rescue
 * anything: it reads the last checkpoint and carries on from a commit that is
 * already on a remote.
 *
 * When there is no checkpoint, the edits died with the node. That is recorded as
 * a loss rather than passed over, because C1 asks for the loss to be visible and
 * an unrecorded one is indistinguishable from work that never happened.
 */

import type { Pool } from "pg";
import { append, read } from "./log.ts";

export const WORKSPACE_OPENED = "workspace.opened";
export const WORKSPACE_CHECKPOINTED = "workspace.checkpointed";
export const WORKSPACE_LOST = "workspace.lost";

export interface Workspace {
	readonly worker: string;
	readonly capabilityId: string;
	/** Where it lives on the node. Useless after the node dies, and recorded anyway. */
	readonly path: string;
	readonly node: string;
	/** The last commit that made it off the machine, or null if none ever did. */
	readonly checkpoint: string | null;
	readonly branch: string | null;
	readonly lost: boolean;
}

/**
 * Every workspace a worker has opened, and how much of each one survived.
 *
 * Pure, so "what would be lost if this node died right now" is answerable
 * without killing anything.
 */
export function foldWorkspaces(
	events: readonly { type: string; payload: Record<string, unknown> }[],
): Workspace[] {
	const open = new Map<string, Workspace>();

	for (const event of events) {
		const p = event.payload;
		const key = String(p.path ?? "");
		if (key === "") continue;

		if (event.type === WORKSPACE_OPENED) {
			open.set(key, {
				worker: String(p.worker ?? ""),
				capabilityId: String(p.capabilityId ?? ""),
				path: key,
				node: String(p.node ?? ""),
				checkpoint: null,
				branch: null,
				lost: false,
			});
		} else if (event.type === WORKSPACE_CHECKPOINTED) {
			const existing = open.get(key);
			if (existing !== undefined) {
				open.set(key, {
					...existing,
					checkpoint: String(p.commit ?? ""),
					branch: String(p.branch ?? ""),
				});
			}
		} else if (event.type === WORKSPACE_LOST) {
			const existing = open.get(key);
			if (existing !== undefined) open.set(key, { ...existing, lost: true });
		}
	}

	return [...open.values()];
}

/** Declare a working tree, so that its existence is in the log before it matters. */
export async function openWorkspace(
	pool: Pool,
	worker: string,
	capabilityId: string,
	path: string,
	node: string,
	epoch: bigint,
): Promise<void> {
	await append(pool, {
		actor: worker,
		type: WORKSPACE_OPENED,
		epoch,
		payload: { v: 1, worker, capabilityId, path, node },
	});
}

/** Record that work reached a remote, and is therefore no longer only on a node. */
export async function checkpointWorkspace(
	pool: Pool,
	worker: string,
	path: string,
	commit: string,
	branch: string,
	epoch: bigint,
): Promise<void> {
	await append(pool, {
		actor: worker,
		type: WORKSPACE_CHECKPOINTED,
		epoch,
		payload: { v: 1, worker, path, commit, branch },
	});
}

/**
 * Record that a workspace died with its node.
 *
 * Written during recovery, by whoever picks the worker up, about work it can
 * never see. The point is that "some edits existed and are gone" is a fact in
 * the log rather than an absence somebody might notice later.
 */
export async function recordWorkspaceLost(
	pool: Pool,
	worker: string,
	path: string,
	reason: string,
	epoch: bigint,
): Promise<void> {
	await append(pool, {
		actor: worker,
		type: WORKSPACE_LOST,
		epoch,
		payload: { v: 1, worker, path, reason },
	});
}

/** Workspaces this worker has open, folded from its own history. */
export async function getWorkspaces(pool: Pool, worker: string): Promise<Workspace[]> {
	return foldWorkspaces(await read(pool, { actor: worker }));
}
