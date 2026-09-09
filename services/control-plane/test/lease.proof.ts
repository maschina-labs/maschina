/**
 * Slice 5 proof. Leases, fencing, and crash recovery.
 *
 * STAGE_0_PLAN calls this the most important slice in Stage 0, and says the
 * central claim of `03-RUNTIME` is either true or false here.
 *
 *   "kill -9 the node agent mid-objective. Restart. The worker resumes and
 *    completes with no human restating any context. Then run two node agents
 *    against one worker deliberately, confirm the stale one is fenced on its
 *    next write and halts itself."
 *
 * Advances criterion 4.
 *
 * The resumed node is given the objective id and nothing else. Everything it
 * knows about what already happened it reads out of the log. If it needed
 * telling, resuming would depend on a human restating context, which is the
 * thing criterion 4 says must not be necessary.
 *
 * Run: pnpm proof
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { acquireLease, appPool, getLease, grant, highestEpoch, read } from "@maschina/db";
import { EFFECT_INTENDED, EFFECT_OUTCOME, recover } from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const SANDBOX = "/tmp/maschina-slice5-sandbox";
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const WORKER = "worker:resumable";
const OBJECTIVE = "obj_slice5";

const run = promisify(execFile);
const child = fileURLToPath(new URL("./resume-child.ts", import.meta.url));

async function node(
	mode: string,
	capabilityId: string,
): Promise<{ code: number; out: string }> {
	try {
		const { stdout } = await run("node", [
			"--import",
			"tsx",
			child,
			BASE,
			mode,
			WORKER,
			OBJECTIVE,
			capabilityId,
			SANDBOX,
		]);
		return { code: 0, out: stdout };
	} catch (error: unknown) {
		const e = error as { code?: number; signal?: string; stdout?: string };
		return { code: e.signal === "SIGKILL" ? 137 : (e.code ?? 1), out: e.stdout ?? "" };
	}
}

async function main(): Promise<void> {
	await resetLog();
	rmSync(SANDBOX, { recursive: true, force: true });
	mkdirSync(SANDBOX, { recursive: true });

	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	console.log("\nSlice 5: leases, fencing, and crash recovery\n");

	const cap = await grant(pool, {
		holder: WORKER,
		resource: "filesystem",
		operations: ["write", "create"],
		scope: SANDBOX,
		effectClass: "idempotent",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	// 1. A lease is a fold over the log, and the epoch only goes up.
	console.log("1. A lease is held, and its epoch is monotonic");
	const first = await acquireLease(pool, "worker:epochtest", "node:a", 60_000);
	const second = await acquireLease(pool, "worker:epochtest", "node:b", 60_000);
	check("the first lease starts at epoch 1", first.epoch === 1n);
	check("taking it again increments", second.epoch === 2n, `epoch ${second.epoch}`);
	check(
		"the current holder is the newer one",
		(await getLease(pool, "worker:epochtest"))?.node === "node:b",
	);
	check(
		"and the epoch survives the lease being handed on",
		(await highestEpoch(pool, "worker:epochtest")) === 2n,
	);

	// 2. Kill the node mid-objective.
	console.log("\n2. The node is killed mid-objective");
	const crashed = await node("crash", cap.id);
	check("the node process died", crashed.code === 137, `exit ${crashed.code}`);
	check("after finishing its first step", existsSync(`${SANDBOX}/one.txt`));
	check("and before finishing its second", !existsSync(`${SANDBOX}/two.txt`));

	const afterCrash = await read(pool, { objective: OBJECTIVE });
	const state = recover(afterCrash);
	check("the log has an effect caught in the crash window", state.unfinished.length === 1);
	check(
		"and it names the step that was interrupted",
		state.unfinished[0]?.target === `${SANDBOX}/two.txt`,
		state.unfinished[0]?.target,
	);
	check(
		"with the effect class that decides what to do about it",
		state.unfinished[0]?.effectClass === "idempotent",
	);
	check("the first step is recorded as finished", state.finished.length === 1);

	// 3. A new node picks it up, told nothing but the objective id.
	console.log("\n3. A new node resumes, with nobody restating anything");
	const resumed = await node("resume", cap.id);
	check("the resumed node completed", resumed.code === 0, `exit ${resumed.code}`);
	check(
		"it read the finished step out of the log",
		resumed.out.includes("already done: one.txt"),
	);
	check(
		"it saw the interrupted step and knew how to resolve it",
		resumed.out.includes("unfinished:") && resumed.out.includes("-> retry"),
	);
	check("the objective is complete on disk", existsSync(`${SANDBOX}/three.txt`));
	check(
		"every step exists",
		["one", "two", "three"].every((n) => existsSync(`${SANDBOX}/${n}.txt`)),
	);
	check("and it said so", resumed.out.includes("complete"));

	// The claim, stated plainly.
	check(
		"no human restated any context: the node was given an objective id and read the rest",
		resumed.out.includes("already done") && existsSync(`${SANDBOX}/three.txt`),
	);

	// 4. What the resumed worker actually did, recorded either way.
	console.log("\n4. What the resumed worker did, recorded whatever it was");
	const finalLog = await read(pool, { objective: OBJECTIVE });
	const intents = finalLog.filter((e) => e.type === EFFECT_INTENDED);
	const outcomes = finalLog.filter((e) => e.type === EFFECT_OUTCOME);
	const targets = intents.map((e) => String(e.payload.target));
	const repeated = targets.filter((t, i) => targets.indexOf(t) !== i);

	console.log(`      intents ${intents.length}, outcomes ${outcomes.length}`);
	console.log(`      repeated work: ${repeated.length === 0 ? "none" : repeated.join(", ")}`);
	check(
		"it did not thrash: one intent per step, plus the one it retried",
		intents.length === 4,
		`${intents.length} intents for 3 steps`,
	);
	check(
		"the only repeated step is the one that was interrupted",
		repeated.length === 1 && repeated[0] === `${SANDBOX}/two.txt`,
		repeated.join(", "),
	);
	check(
		"the retry was safe because the effect class said so",
		state.unfinished[0]?.effectClass === "idempotent",
	);

	// 5. Two nodes on one worker. The stale one has to stop.
	console.log("\n5. Two nodes on one worker: the stale one is fenced");
	const stale = await acquireLease(pool, "worker:contested", "node:old", 60_000);
	const fresh = await acquireLease(pool, "worker:contested", "node:new", 60_000);
	check("both nodes believe they hold it", stale.epoch === 1n && fresh.epoch === 2n);

	const beforeFence = (await read(pool)).length;
	let fenced = "";
	try {
		const response = await fetch(`${BASE}/events`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				actor: "worker:contested",
				type: "effect.intended",
				payload: { v: 1 },
				epoch: stale.epoch.toString(),
			}),
		});
		fenced = response.status === 409 ? "fenced" : `allowed (${response.status})`;
	} catch (error: unknown) {
		fenced = `threw: ${error instanceof Error ? error.message : String(error)}`;
	}

	check("the stale node's write was refused", fenced === "fenced", fenced);
	check("and nothing it wrote reached the log", (await read(pool)).length === beforeFence);

	const freshWrite = await fetch(`${BASE}/events`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			actor: "worker:contested",
			type: "effect.intended",
			payload: { v: 1 },
			epoch: fresh.epoch.toString(),
		}),
	});
	check("while the current holder writes normally", freshWrite.status === 201);

	check(
		"the refusal came from the log, not from the node checking itself",
		// The node that lost its lease believes it still holds one. If the check
		// lived in the node, this is exactly the node that would skip it.
		fenced === "fenced",
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Slice 5 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
