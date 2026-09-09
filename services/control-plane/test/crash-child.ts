/**
 * A worker that dies between Intent and Outcome.
 *
 * Spawned by the boundary proof. Talks to a real control plane over HTTP, like
 * any node does, and SIGKILLs itself inside the executor. SIGKILL is
 * uncatchable, so this is a real kill rather than a simulation of one.
 *
 * The state it leaves behind is the point: an Intent in the log with no Outcome,
 * written by a process that is now gone, held by a service that is still
 * running. That is the crash window the node boundary has to survive.
 */

import type { Executor } from "@maschina/worker";
import { httpControlPlane, performEffect } from "@maschina/worker";

const [baseUrl, capabilityId, target] = process.argv.slice(2);
if (!baseUrl || !capabilityId || !target) {
	throw new Error("usage: crash-child <baseUrl> <capabilityId> <target>");
}

const suicidal: Executor = async () => {
	// After the Intent is durable on the control plane, before anything reaches
	// this node's disk.
	process.kill(process.pid, "SIGKILL");
	return {};
};

await performEffect(
	httpControlPlane(baseUrl),
	{ worker: "worker:doomed", objective: null, reasoning: "about to be killed" },
	{ capabilityId, operation: "write", target, payload: { content: "never written" } },
	"idempotent",
	suicidal,
);
