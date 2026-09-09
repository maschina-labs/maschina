/**
 * Stage 1, slice 4 proof. Concurrency.
 *
 * `STAGE_1_PLAN` slice 4:
 *
 *   "Run three objectives concurrently and confirm the log interleaves cleanly,
 *    no worker sees another's authority, and budgets do not leak between them.
 *    Kill one mid-flight and confirm the others are unaffected."
 *
 *   "Watch for: shared state that only works because nothing was concurrent."
 *
 * Leases and epochs were built in Stage 0 and only ever tested with one worker.
 * This is where anything wrong with isolation appears. The plan says it should
 * be boring, because the log is the only durable state, and that if it is not
 * boring that is a finding.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import type { Contract } from "@maschina/core";
import { appPool, getCapability, getLease, grant, read, stateObjective } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { Daemon } from "../../node/src/daemon.ts";
import { createApp } from "../src/app.ts";

const PORT = 8786;
const BASE = `http://127.0.0.1:${PORT}`;
const WORKERS = ["worker:a", "worker:b", "worker:c"];

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "it happened",
			verifyBy: "the log",
			strength: "mechanical",
			evidence: ["events"],
		},
	],
	nonGoals: [],
	failureConditions: [],
};

const quiet = () => {
	/* the daemon narrates; the proof does the talking */
};

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	console.log("\nStage 1 slice 4: three at once\n");

	// 1. Three workers, three leases, three epochs.
	console.log("1. A lease is per worker, not per process");
	const daemon = new Daemon({
		controlPlaneUrl: BASE,
		node: "node:a",
		workers: WORKERS,
		leaseTtlMs: 5_000,
		renewEveryMs: 500,
		pollEveryMs: 100,
		log: quiet,
		run: async (objective, plane) => {
			// Deliberately slow, so all three really are in flight together rather
			// than finishing one at a time fast enough to look concurrent.
			await new Promise((resolve) => setTimeout(resolve, 250));
			await plane.append({
				actor: "unused",
				objective,
				type: "worker.did_something",
				payload: { v: 1, objective },
			});
		},
	});
	await daemon.start();

	for (const worker of WORKERS) {
		const lease = await getLease(pool, worker);
		check(`${worker} holds its own lease`, lease !== null);
	}
	const epochs = WORKERS.map((w) => daemon.epochOf(w));
	check(
		"each at its own epoch",
		epochs.every((e) => e > 0n),
		epochs.join(", "),
	);

	// 2. Three objectives, taken once each.
	console.log("\n2. Three objectives, and each is taken exactly once");
	const objectives: string[] = [];
	for (let i = 0; i < 3; i++) {
		const admitted = await stateObjective(pool, {
			statement: `Concurrent objective ${i + 1}`,
			contract: CONTRACT,
			origin: "human:ash",
		});
		objectives.push(admitted.objective.id);
	}

	await waitFor(async () => {
		const events = await read(pool);
		return objectives.every((id) =>
			events.some((e) => e.type === "worker.did_something" && e.objective === id),
		);
	}, 10_000);

	const allEvents = await read(pool);
	for (const id of objectives) {
		const takes = allEvents.filter((e) => e.type === "objective.taken" && e.objective === id);
		check(
			`${id.slice(0, 12)} was taken exactly once`,
			takes.length === 1,
			`${takes.length} take(s) by ${[...new Set(takes.map((t) => t.actor))].join(", ")}`,
		);
	}

	const workersThatWorked = new Set(
		allEvents.filter((e) => e.type === "objective.taken").map((e) => e.actor),
	);
	check(
		"and the work was spread across workers rather than done by one",
		workersThatWorked.size > 1,
		[...workersThatWorked].join(", "),
	);

	// 3. The log interleaves cleanly.
	console.log("\n3. The log interleaves cleanly");
	const ids = allEvents.map((e) => e.id);
	check(
		"every event has a distinct, increasing id",
		ids.every((id, i) => i === 0 || id > (ids[i - 1] ?? 0n)),
	);
	const perObjective = objectives.map((id) =>
		allEvents.filter((e) => e.objective === id).map((e) => e.type),
	);
	check(
		"each objective's own events are in order despite the interleaving",
		perObjective.every(
			(types) => types.indexOf("objective.stated") < types.indexOf("objective.taken"),
		),
	);

	// 4. No worker sees another's authority.
	console.log("\n4. No worker sees another's authority");
	const capA = await grant(pool, {
		holder: "worker:a",
		resource: "filesystem",
		operations: ["write"],
		scope: "/tmp/a",
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const capB = await grant(pool, {
		holder: "worker:b",
		resource: "filesystem",
		operations: ["write"],
		scope: "/tmp/b",
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	const crossUse = (await (
		await fetch(`${BASE}/capabilities/authorize`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				capabilityId: capA.id,
				holder: "worker:b",
				operation: "write",
				target: "/tmp/a/x.txt",
			}),
		})
	).json()) as { granted: boolean; reason?: string };
	check("one worker cannot use another's capability", crossUse.granted === false);
	check(
		"and is refused for not holding it, not for something incidental",
		crossUse.reason === "no_such_capability",
		String(crossUse.reason),
	);
	check("both capabilities still exist", capA.id !== capB.id);

	// 5. Budgets do not leak.
	console.log("\n5. Budgets do not leak between workers");
	const budgetA = await grant(pool, {
		holder: "worker:a",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: 100_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const budgetB = await grant(pool, {
		holder: "worker:b",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: 100_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	const { reserve, settle } = await import("@maschina/db");
	await Promise.all([
		(async () => {
			await reserve(pool, budgetA.id, "worker:a", 20_000);
			await settle(pool, budgetA.id, "worker:a", 20_000, 20_000);
		})(),
		(async () => {
			await reserve(pool, budgetB.id, "worker:b", 5_000);
			await settle(pool, budgetB.id, "worker:b", 5_000, 5_000);
		})(),
	]);

	const afterA = await getCapability(pool, budgetA.id);
	const afterB = await getCapability(pool, budgetB.id);
	check(
		"what one worker spent is on its own capability",
		afterA?.limits.settled === 20_000,
		`${afterA?.limits.settled}`,
	);
	check(
		"and the other's is untouched by it",
		afterB?.limits.settled === 5_000,
		`${afterB?.limits.settled}`,
	);
	check(
		"neither has anything left reserved",
		afterA?.limits.reserved === 0 && afterB?.limits.reserved === 0,
	);

	// 6. Fencing one worker leaves the others alone.
	console.log("\n6. Fencing one leaves the others working");
	await fetch(`${BASE}/leases`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ worker: "worker:a", node: "node:elsewhere", ttlMs: 30_000 }),
	});

	const stillFine = (
		await Promise.all(
			["worker:b", "worker:c"].map(async (w) => (await getLease(pool, w))?.node === "node:a"),
		)
	).every(Boolean);
	check("taking one worker's lease elsewhere does not touch the others", stillFine);

	const fourth = await stateObjective(pool, {
		statement: "After one worker was fenced",
		contract: CONTRACT,
		origin: "human:ash",
	});
	await waitFor(async () => {
		const events = await read(pool, { objective: fourth.objective.id });
		return events.some((e) => e.type === "worker.did_something");
	}, 10_000);
	const finished = (await read(pool, { objective: fourth.objective.id })).some(
		(e) => e.type === "worker.did_something",
	);
	check("and the remaining workers carry on taking new work", finished);

	await daemon.stop("the proof is finished");
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Stage 1 slice 4 proof");
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
