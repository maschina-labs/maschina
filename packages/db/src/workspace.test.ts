/**
 * Workspaces.
 *
 * This answers "what would be lost if this node died right now", which is the
 * question `15-OPEN-QUESTIONS` C1 exists to make answerable at all.
 */

import { describe, expect, it } from "vitest";
import {
	foldWorkspaces,
	WORKSPACE_CHECKPOINTED,
	WORKSPACE_LOST,
	WORKSPACE_OPENED,
} from "./workspace.ts";

type LogEvent = { type: string; payload: Record<string, unknown> };

const opened = (path = "/tmp/tree"): LogEvent => ({
	type: WORKSPACE_OPENED,
	payload: { v: 1, worker: "worker:w1", capabilityId: "cap_1", path, node: "node:a" },
});

const checkpointed = (commit: string, path = "/tmp/tree"): LogEvent => ({
	type: WORKSPACE_CHECKPOINTED,
	payload: { v: 1, worker: "worker:w1", path, commit, branch: "maschina/wip" },
});

const lost = (path = "/tmp/tree"): LogEvent => ({
	type: WORKSPACE_LOST,
	payload: { v: 1, worker: "worker:w1", path, reason: "the node died before any checkpoint" },
});

describe("foldWorkspaces", () => {
	it("finds nothing when nothing was opened", () => {
		expect(foldWorkspaces([])).toHaveLength(0);
	});

	it("reports an opened workspace with nothing saved yet", () => {
		// The dangerous state: a tree exists on a node and none of it has reached
		// anywhere else. Everything in it dies with the machine.
		const [tree] = foldWorkspaces([opened()]);
		expect(tree?.checkpoint).toBeNull();
		expect(tree?.lost).toBe(false);
	});

	it("records the commit that got the work off the machine", () => {
		const [tree] = foldWorkspaces([opened(), checkpointed("abc123")]);
		expect(tree?.checkpoint).toBe("abc123");
		expect(tree?.branch).toBe("maschina/wip");
	});

	it("keeps the most recent checkpoint", () => {
		// Checkpoints happen as work proceeds, so there are many, and only the
		// last one says where to resume from.
		const [tree] = foldWorkspaces([opened(), checkpointed("first"), checkpointed("second")]);
		expect(tree?.checkpoint).toBe("second");
	});

	it("marks a workspace lost when nothing ever reached a remote", () => {
		const [tree] = foldWorkspaces([opened(), lost()]);
		expect(tree?.lost).toBe(true);
		expect(tree?.checkpoint).toBeNull();
	});

	it("keeps the checkpoint on a workspace that was lost after one", () => {
		// Losing the tree does not unmake the commits that already left it. The
		// work up to the last checkpoint is still on a remote, and saying
		// otherwise would throw away recoverable work.
		const [tree] = foldWorkspaces([opened(), checkpointed("abc123"), lost()]);
		expect(tree?.lost).toBe(true);
		expect(tree?.checkpoint).toBe("abc123");
	});

	it("tracks several workspaces independently", () => {
		const trees = foldWorkspaces([
			opened("/tmp/one"),
			opened("/tmp/two"),
			checkpointed("abc", "/tmp/one"),
		]);
		expect(trees).toHaveLength(2);
		expect(trees.find((t) => t.path === "/tmp/one")?.checkpoint).toBe("abc");
		expect(trees.find((t) => t.path === "/tmp/two")?.checkpoint).toBeNull();
	});

	it("ignores a checkpoint for a workspace nobody opened", () => {
		// A checkpoint with no opening is not half a workspace, it is a claim
		// about something that was never declared. Inventing one from it would
		// mean the log could grow workspaces nobody created.
		expect(foldWorkspaces([checkpointed("abc")])).toHaveLength(0);
	});

	it("ignores events with no path, rather than inventing a key for them", () => {
		expect(foldWorkspaces([{ type: WORKSPACE_OPENED, payload: { v: 1 } }])).toHaveLength(0);
	});

	it("is deterministic", () => {
		const events = [opened(), checkpointed("abc")];
		expect(foldWorkspaces(events)).toEqual(foldWorkspaces(events));
	});
});
