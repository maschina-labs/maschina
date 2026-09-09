/**
 * A worker that dies between Intent and Outcome.
 *
 * Spawned by the slice 2 proof. Takes a capability id and a target, performs a
 * filesystem write whose executor SIGKILLs this process, and therefore never
 * writes an Outcome. SIGKILL is uncatchable, so this is `kill -9` rather than a
 * simulation of it.
 *
 * The point is the state it leaves behind: an Intent in the log with no Outcome,
 * which is the one crash window in the system (`03-RUNTIME` §3).
 */

import { appPool } from "@maschina/db";
import type { Executor } from "../src/effect.ts";
import { performEffect } from "../src/effect.ts";

const [capabilityId, target] = process.argv.slice(2);
if (!capabilityId || !target) throw new Error("usage: crash-child <capabilityId> <target>");

const suicidal: Executor = async () => {
	// After the Intent is durable, before anything is written to disk.
	process.kill(process.pid, "SIGKILL");
	return {};
};

const pool = appPool();
await performEffect(
	pool,
	{ worker: "worker:doomed", objective: null, reasoning: "about to be killed" },
	{ capabilityId, operation: "write", target, payload: { content: "never written" } },
	"idempotent",
	suicidal,
);
await pool.end();
