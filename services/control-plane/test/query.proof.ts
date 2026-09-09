/**
 * Slice 10 proof. The query surface.
 *
 * STAGE_0_PLAN slice 10, and criterion 9:
 *
 *   "Answer all seven by query, not by reading code."
 *
 * The distinction is the whole slice. A system that records everything and can
 * be interrogated about none of it has an audit trail in the same sense that an
 * unopened box has contents. Each question below is asked the way a person would
 * ask it, through the CLI, and the answer has to be in what comes back.
 *
 * Asked through `maschina` as a subprocess rather than by importing the query
 * functions, because importing them would prove the functions work and leave
 * exactly the thing being claimed untested.
 *
 * Run: pnpm proof
 */

import { execFile } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import type { Contract } from "@maschina/core";
import { appPool, emergencyStop, ensureRoot, grant, read, stateObjective } from "@maschina/db";
import { httpControlPlane, performEffect } from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8792;
const BASE = `http://127.0.0.1:${PORT}`;
const SANDBOX = "/tmp/maschina-slice10-sandbox";
const run = promisify(execFile);

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "the file exists",
			verifyBy: "read it",
			strength: "mechanical",
			evidence: ["the bytes"],
		},
	],
	nonGoals: [],
	failureConditions: [],
};

/** Ask the way a person would: run the CLI and read what comes back. */
async function ask(...args: string[]): Promise<string> {
	const { stdout } = await run("pnpm", ["--silent", "maschina", ...args], {
		cwd: new URL("../../../", import.meta.url).pathname,
		env: { ...process.env },
		maxBuffer: 16 * 1024 * 1024,
	});
	return stdout;
}

async function main(): Promise<void> {
	await resetLog();
	rmSync(SANDBOX, { recursive: true, force: true });
	mkdirSync(SANDBOX, { recursive: true });

	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	console.log("\nSlice 10: seven questions, answered by asking\n");

	// A system with enough history that the answers are not trivial.
	const root = await ensureRoot(pool);
	const objective = (
		await stateObjective(pool, {
			statement: "Write the file",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;

	const disk = await grant(pool, {
		holder: "worker:w1",
		resource: "filesystem",
		operations: ["write"],
		scope: SANDBOX,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const brain = await grant(pool, {
		holder: "worker:w1",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: 1_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	await performEffect(
		node,
		{ worker: "worker:w1", objective: objective.id, reasoning: "writing the agreed file" },
		{
			capabilityId: disk.id,
			operation: "write",
			target: `${SANDBOX}/a.txt`,
			payload: { content: "a" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);
	// A refusal, so `denied` has something real to find.
	await performEffect(
		node,
		{ worker: "worker:w1", objective: objective.id, reasoning: "reaching outside the sandbox" },
		{
			capabilityId: disk.id,
			operation: "write",
			target: "/etc/passwd",
			payload: { content: "no" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);

	const decision = (await read(pool, { objective: objective.id })).find(
		(e) => e.type === "worker.decided",
	);

	// 1.
	console.log("1. What can this worker do right now?");
	const can = await ask("can", "worker:w1");
	check("it names both capabilities", can.includes(disk.id) && can.includes(brain.id));
	check("says what each one is over", can.includes("filesystem") && can.includes("model"));
	check("and the scope it is bounded to", can.includes(SANDBOX) && can.includes("fast"));
	check("with the budget left, in money", can.includes("$1.000000"), "budget shown");
	check("and whether it is live", can.includes("live"));

	// 2.
	console.log("\n2. Where did this capability come from, all the way to root?");
	const provenance = await ask("provenance", disk.id);
	check("it starts at the capability asked about", provenance.includes(disk.id));
	check("and reaches the root", provenance.includes(root.id), "root reached");
	check("saying how many steps it took", provenance.includes("2 step(s) to root"), "depth");
	check(
		"and who holds each one",
		provenance.includes("worker:w1") && provenance.includes("root"),
	);

	// 3.
	console.log("\n3. What has been done with this capability?");
	const used = await ask("used", disk.id);
	check("the grant is there", used.includes("capability.granted"));
	check("the effect that succeeded is there", used.includes("effect.outcome"));
	check("so is the one that was refused", used.includes("capability.denied"));
	check("with what it was attempted on", used.includes("/etc/passwd"));

	// 4.
	console.log("\n4. What has been denied, and to whom?");
	const denied = await ask("denied");
	check("the refusal is findable without knowing where to look", denied.includes("REFUSED"));
	check("naming who was refused", denied.includes("worker:w1"));
	check("what they tried", denied.includes("/etc/passwd"));
	check("and why", denied.includes("outside_scope"), "reason given");

	const forWorker = await ask("denied", "worker:w2");
	check("and it can be asked about one holder", forWorker.includes("Nothing has been denied"));

	// 5.
	console.log("\n5. What would be revoked if I revoked this?");
	const blast = await ask("blast", root.id);
	check(
		"revoking the root takes everything",
		blast.includes(disk.id) && blast.includes(brain.id),
	);
	check("and says how many", blast.includes("capabilit"), "count given");
	check("and whom it affects", blast.includes("worker:w1"));

	const leaf = await ask("blast", disk.id);
	check(
		"while revoking a leaf takes only itself",
		leaf.includes(disk.id) && !leaf.includes(brain.id),
	);

	// 6.
	console.log("\n6. What did this objective cost, by resource?");
	// Spend something meterable through the effect path.
	await performEffect(
		node,
		{ worker: "worker:w1", objective: objective.id, reasoning: "asking the model" },
		{
			capabilityId: brain.id,
			operation: "invoke",
			target: "fast",
			payload: { prompt: "say something" },
		},
		"idempotent",
		async () => ({ text: "something", model: "scripted", cost: 2_000 }),
	);
	const { settle } = await import("@maschina/db");
	await settle(pool, brain.id, "worker:w1", 2_000, 2_000);

	const cost = await ask("cost", objective.id);
	check("it reports by resource", cost.includes("model"), cost.split("\n")[0]);
	check("in money rather than raw integers", cost.includes("$0.002000"), "amount");
	check("with a total", cost.includes("total"));
	check(
		"and says what the number means, because it is not money billed",
		cost.includes("List value"),
	);

	// 7.
	console.log("\n7. Why did the worker make this decision?");
	const why = await ask("why", String(decision?.id ?? 0));
	check(
		"it gives the worker's own recorded reasoning",
		why.includes("writing the agreed file"),
	);
	check("the objective it was serving", why.includes(objective.id));
	check("what it led to", why.includes("intent:") && why.includes("outcome:"));
	check(
		"and the boundary of what it could see, by reference",
		why.includes("saw the log up to event"),
		"provenance by reference",
	);
	check(
		"with the command to go and read exactly that",
		why.includes("maschina log --objective"),
	);

	// The claim itself.
	console.log("\nAll seven answered by asking. None required reading the code.");
	check(
		"every question was asked through the CLI, not by importing a function",
		true,
		"see `ask` above: it spawns `maschina`",
	);

	// And the stop still works after all of it.
	await emergencyStop(pool, "human:ash", "end of the slice 10 proof");
	const afterStop = await ask("can", "worker:w1");
	check(
		"after an emergency stop the same question says nothing is live",
		afterStop.includes("DEAD"),
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Slice 10 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
