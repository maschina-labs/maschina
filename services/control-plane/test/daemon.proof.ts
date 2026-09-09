/**
 * Stage 1, slice 1 proof. The daemon.
 *
 * `STAGE_1_PLAN` slice 1:
 *
 *   "Start it, give it an objective, watch it finish without anybody invoking a
 *    step. Kill it mid-objective and start it again: it resumes. Stop it
 *    politely and confirm it released its lease rather than leaving one to
 *    expire."
 *
 * Everything in Stage 0 ran because a proof ran it. This is the first thing that
 * runs because it is running.
 *
 * Lives here rather than beside the daemon, and that is the boundary working.
 * The proof needs a database to check what the daemon did, and the daemon must
 * never have one. `.github/ci/check-node-boundary.mjs` refused the first version
 * of this file for exactly that reason.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import type { Contract } from "@maschina/core";
import { appPool, getLease, highestEpoch, read, stateObjective } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { Daemon } from "../../node/src/daemon.ts";
import { createApp } from "../src/app.ts";

const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;
const WORKER = "worker:daemon";

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "something happens",
			verifyBy: "look at the log",
			strength: "mechanical",
			evidence: ["the events"],
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

	console.log("\nStage 1 slice 1: something that stays running\n");

	// 1. It takes a lease and holds it.
	console.log("1. It holds a lease while it is up");
	const taken: string[] = [];
	const daemon = new Daemon({
		controlPlaneUrl: BASE,
		node: "node:a",
		workers: [WORKER],
		leaseTtlMs: 5_000,
		renewEveryMs: 500,
		pollEveryMs: 200,
		log: quiet,
		run: async (objective, plane) => {
			taken.push(objective);
			await plane.append({
				actor: WORKER,
				objective,
				type: "worker.took_objective",
				payload: { v: 1, objective },
			});
		},
	});

	await daemon.start();
	const lease = await getLease(pool, WORKER);
	check("a lease exists", lease !== null);
	check("held by the node that started", lease?.node === "node:a", lease?.node);
	check("at a real epoch", (lease?.epoch ?? 0n) > 0n, String(lease?.epoch));

	// 2. Work appears, and nobody tells it.
	console.log("\n2. Work appears and it picks it up, with nobody invoking a step");
	const first = (
		await stateObjective(pool, {
			statement: "The first thing the daemon ever found",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;

	await waitFor(() => taken.includes(first.id), 5_000);
	check("it found the objective on its own", taken.includes(first.id));
	const tookEvents = (await read(pool, { objective: first.id })).filter(
		(e) => e.type === "worker.took_objective",
	);
	check("and recorded taking it", tookEvents.length === 1);
	check(
		"writing at the lease's epoch, so the log can fence it",
		tookEvents[0]?.epoch === daemon.epochOf(WORKER),
		`event ${tookEvents[0]?.epoch}, lease ${daemon.epochOf(WORKER)}`,
	);

	// 3. It keeps its lease alive without being asked.
	console.log("\n3. It renews without being asked");
	const before = await getLease(pool, WORKER);
	await new Promise((resolve) => setTimeout(resolve, 1_200));
	const after = await getLease(pool, WORKER);
	check("the lease is still held", after !== null);
	check(
		"and its expiry moved, so it renewed itself",
		(after?.expiresAt.getTime() ?? 0) > (before?.expiresAt.getTime() ?? 0),
	);
	check(
		"at the same epoch, because renewing is not a new generation",
		after?.epoch === before?.epoch,
	);

	// 4. More work, still nobody asking.
	console.log("\n4. It keeps going");
	const second = (
		await stateObjective(pool, {
			statement: "The second thing",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;
	await waitFor(() => taken.includes(second.id), 5_000);
	check("it took the next objective too", taken.includes(second.id));
	check("two objectives, one running process, no human in the loop", taken.length === 2);

	// 5. Stopping politely gives the lease back.
	console.log("\n5. Stopping gives the lease back rather than letting it expire");
	const epochBeforeStop = await highestEpoch(pool, WORKER);
	await daemon.stop("the proof is finished");
	const afterStop = await getLease(pool, WORKER);
	check("no lease is held afterwards", afterStop === null);
	const released = (await read(pool, { actor: WORKER })).filter(
		(e) => e.type === "lease.released",
	);
	check("it said so, rather than going quiet", released.length === 1);
	check(
		"and the epoch did not move, because releasing is not reassigning",
		(await highestEpoch(pool, WORKER)) === epochBeforeStop,
	);

	// 6. A second daemon takes over, at a higher epoch.
	console.log("\n6. Another one takes over, and the epoch goes up");
	const successor = new Daemon({
		controlPlaneUrl: BASE,
		node: "node:b",
		workers: [WORKER],
		leaseTtlMs: 5_000,
		renewEveryMs: 500,
		pollEveryMs: 200,
		log: quiet,
		run: async () => {
			/* nothing left to do */
		},
	});
	await successor.start();
	check("it holds the lease now", (await getLease(pool, WORKER))?.node === "node:b");
	check(
		"at a higher epoch than the one before it",
		successor.epochOf(WORKER) > epochBeforeStop,
		`${successor.epochOf(WORKER)} > ${epochBeforeStop}`,
	);
	await successor.stop("done");

	// 7. It decides nothing.
	console.log("\n7. The daemon holds no judgment");
	const daemonSource = await import("node:fs").then((fs) =>
		fs.readFileSync(new URL("../../node/src/daemon.ts", import.meta.url), "utf8"),
	);
	check(
		"it never authorises anything itself",
		!daemonSource.includes("authorize("),
		"scheduling is not judgment",
	);
	check("and never invokes a model", !daemonSource.includes("invokeModel"));
	check(
		"what to do with an objective is injected, not decided here",
		daemonSource.includes("readonly run:"),
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Stage 1 slice 1 proof");
}

/** Wait for something the daemon does on its own, rather than making it happen. */
async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
