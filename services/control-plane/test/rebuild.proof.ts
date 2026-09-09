/**
 * Slice 9 proof. Projection rebuild.
 *
 * STAGE_0_PLAN slice 9:
 *
 *   "Delete every projection. Rebuild from the log. The system is unchanged.
 *    This is the direct test of `02-CORE` §7, and if it fails, the load-bearing
 *    bet of the entire architecture has failed."
 *
 * Advances criterion 10.
 *
 * The bet is that the event log is the only durable state and everything else is
 * derived. This does not test it by deleting a cache, because there is no cache:
 * `events` is the only table, and every capability, objective, lease, workspace
 * and evaluation is folded when it is asked for. So this tests the stronger
 * claim available: **destroy the entire database except the log, put the log
 * back, and check that every derived answer is byte for byte what it was.**
 *
 * Also measures what folding costs as history grows, which is amendment A3.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import type { Contract } from "@maschina/core";
import {
	adminPool,
	applySchema,
	appPool,
	dumpLog,
	grant,
	openWorkspace,
	read,
	recordEvaluation,
	restoreLog,
	snapshot,
	stateObjective,
} from "@maschina/db";
import { httpControlPlane, performEffect } from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}`;
const SANDBOX = "/tmp/maschina-slice9-sandbox";

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "the thing is done",
			verifyBy: "look at it",
			strength: "mechanical",
			evidence: ["the output"],
		},
	],
	nonGoals: [],
	failureConditions: [],
};

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	console.log("\nSlice 9: the log is the only durable state, or it is not\n");

	// 1. Build up a system with something of every kind in it.
	console.log("1. A system with history in it");
	const objective = (
		await stateObjective(pool, {
			statement: "Something worth rebuilding",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;

	const cap = await grant(pool, {
		holder: "worker:builder",
		resource: "filesystem",
		operations: ["write"],
		scope: SANDBOX,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	await performEffect(
		node,
		{ worker: "worker:builder", objective: objective.id, reasoning: "doing work" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: `${SANDBOX}/a.txt`,
			payload: { content: "a" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);
	// A denial, so the history contains a refusal and not only successes.
	await performEffect(
		node,
		{ worker: "worker:builder", objective: objective.id, reasoning: "overreaching" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: "/etc/passwd",
			payload: { content: "no" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);
	await openWorkspace(pool, "worker:builder", cap.id, "/tmp/tree", "node:a", 0n);
	await recordEvaluation(pool, objective.id, "worker:judge", "frozen", [
		{
			criterionId: "c1",
			result: "satisfied",
			evidence: ["e"],
			method: "mechanical",
			notes: "",
		},
	]);

	const before = await snapshot(pool);
	check("the log has real history in it", before.events > 10, `${before.events} events`);
	check("with capabilities", before.capabilities.includes(cap.id));
	check("objectives", before.objectives.includes(objective.id));
	check("workspaces", before.workspaces.includes("/tmp/tree"));
	check("and verdicts", before.evaluations.includes("satisfied"));

	// 2. Take the log out, then destroy everything.
	console.log("\n2. Destroy the database, keeping only the log");
	const admin = adminPool();
	const dumped = await dumpLog(admin);
	check("the log was dumped whole", dumped.length === before.events, `${dumped.length}`);
	check(
		"with the ids that causation refers to",
		dumped.every((e) => e.id.length > 0),
	);

	await admin.query("DROP TABLE IF EXISTS events CASCADE");
	await admin.query("DROP FUNCTION IF EXISTS events_is_append_only() CASCADE");
	await admin.query("DROP FUNCTION IF EXISTS events_fence() CASCADE");
	const gone = await admin.query<{ n: string }>(
		"SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'",
	);
	check("nothing is left", gone.rows[0]?.n === "0", `${gone.rows[0]?.n} tables`);

	// 3. Put it back from the log alone.
	console.log("\n3. Rebuild from the log alone");
	await applySchema(admin);
	const restoredStart = Date.now();
	const restored = await restoreLog(admin, dumped);
	const restoreMs = Date.now() - restoredStart;
	check("every event went back", restored === dumped.length, `${restored}`);

	const rebuiltPool = appPool();
	const after = await snapshot(rebuiltPool);

	// 4. The system is unchanged. This is the whole slice.
	console.log("\n4. The system is unchanged");
	check("the same number of events", after.events === before.events, `${after.events}`);
	check("every capability is identical", after.capabilities === before.capabilities);
	check("every objective is identical", after.objectives === before.objectives);
	check("every workspace is identical", after.workspaces === before.workspaces);
	check("every verdict is identical", after.evaluations === before.evaluations);

	// Causation is the part that renumbering would silently break.
	const events = await read(rebuiltPool);
	const withCausation = events.filter((e) => e.causation !== null);
	const ids = new Set(events.map((e) => e.id));
	check("causal links survived", withCausation.length > 0, `${withCausation.length} linked`);
	check(
		"and every one of them still points at an event that exists",
		withCausation.every((e) => e.causation !== null && ids.has(e.causation)),
	);

	// 5. The restored log is still append-only and still fenced.
	console.log("\n5. And it is still a log, not just a table");
	let mutable = "";
	try {
		await rebuiltPool.query("UPDATE events SET actor = 'tampered' WHERE id = $1", [
			events[0]?.id.toString(),
		]);
		mutable = "ALLOWED";
	} catch (error: unknown) {
		mutable = error instanceof Error ? error.message.slice(0, 40) : "refused";
	}
	check("it cannot be updated", mutable !== "ALLOWED", mutable);

	const appended = await rebuiltPool.query<{ id: string }>(
		"INSERT INTO events (actor, type, payload, epoch) VALUES ($1,$2,$3,$4) RETURNING id::text",
		["human:ash", "probe.after_restore", {}, 0],
	);
	const nextId = BigInt(appended.rows[0]?.id ?? "0");
	check(
		"and the next append does not collide with a restored id",
		nextId > (events[events.length - 1]?.id ?? 0n),
		`${nextId}`,
	);

	// 6. What it cost. A3's measurement.
	console.log("\n6. What the bet costs, measured");
	console.log(`      fold of everything:  ${before.foldMs}ms over ${before.events} events`);
	console.log(`      restore of the log:  ${restoreMs}ms`);
	check(
		"folding the whole system is still fast enough to do per step",
		before.foldMs < 1000,
		`${before.foldMs}ms`,
	);
	console.log("      A3 predicts this bites first in per-step context assembly.");
	console.log(
		"      Nothing is materialised yet, and nothing should be until this number says so.",
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	await rebuiltPool.end();
	await admin.end();
	verdict("Slice 9 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
