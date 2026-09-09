/**
 * Slice 8 proof. The emergency stop.
 *
 * STAGE_0_PLAN slice 8:
 *
 *   "With a worker mid-objective, run one command. Every worker loses all
 *    authority immediately. Confirm the worker's next effect attempt is denied
 *    and recorded. Confirm no process needed to cooperate and the node did not
 *    need to be reachable."
 *
 * Advances criterion 8.
 *
 * **This proof is re-run at every stage boundary, forever** (`12-SECURITY` §6).
 * An untested stop is a belief, not a control, and it is the one control
 * `01-PRINCIPLES` P13 says never yields. Run it on its own with
 * `pnpm stop:test`.
 *
 * The node here is a real separate process that is deliberately never signalled,
 * never told, and still running when its authority disappears. That is the whole
 * claim: workers do not cooperate with the stop, they simply cannot act.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import {
	appPool,
	emergencyStop,
	ensureRoot,
	getCapability,
	grant,
	liftEmergencyStop,
	liveCapabilities,
	ROOT_HOLDER,
	read,
} from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8794;
const BASE = `http://127.0.0.1:${PORT}`;
const SANDBOX = "/tmp/maschina-slice8-sandbox";
const run = promisify(execFile);
const child = fileURLToPath(new URL("./stop-child.ts", import.meta.url));

async function main(): Promise<void> {
	await resetLog();
	rmSync(SANDBOX, { recursive: true, force: true });
	mkdirSync(SANDBOX, { recursive: true });

	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	console.log("\nSlice 8: one command, and nothing can act\n");

	// 1. The tree is actually a tree.
	console.log("1. Every capability descends from one root");
	const root = await ensureRoot(pool);
	check("the root exists", root.status === "active");
	check("held by nobody who could use it", root.holder === ROOT_HOLDER);
	check("and it is the only capability with no parent", root.parent === null);

	const caps = await Promise.all(
		["worker:a", "worker:b", "worker:c"].map((holder) =>
			grant(pool, {
				holder,
				resource: "filesystem",
				operations: ["write"],
				scope: SANDBOX,
				effectClass: "idempotent",
				checkpoint: "none",
				approval: "none",
				delegationDepth: 0,
				grantedBy: "human:ash",
			}),
		),
	);
	check(
		"three workers hold authority",
		caps.every((c) => c.status === "active"),
	);
	check(
		"and every one of them descends from the root",
		caps.every((c) => c.parent === root.id),
		caps.map((c) => c.parent).join(","),
	);

	const before = await liveCapabilities(pool);
	check("so four capabilities are live", before.length === 4, `${before.length}`);

	// 2. A worker is mid-objective, in its own process, and stays running.
	console.log("\n2. A worker is running in its own process, and is not told anything");
	const node = run("node", [
		"--import",
		"tsx",
		child,
		BASE,
		caps[0]?.id ?? "",
		"worker:a",
		`${SANDBOX}/step`,
	]);

	// Let it get going and write its first file, so this is genuinely mid-objective.
	await new Promise((resolve) => setTimeout(resolve, 1200));
	check("it has started doing real work", existsSync(`${SANDBOX}/step-1.txt`));

	// 3. One command.
	console.log("\n3. One command");
	const stopped = await emergencyStop(pool, "human:ash", "proof");
	check(
		"it revoked the root and everything under it",
		stopped.length === 4,
		`${stopped.length}`,
	);
	check("including capabilities it was never told about", stopped.includes(caps[2]?.id ?? ""));

	const after = await liveCapabilities(pool);
	check("nothing is live afterwards", after.length === 0, `${after.length} left`);

	// 4. The worker was never asked, and could not have refused.
	console.log("\n4. The worker did not cooperate, because it was never asked");
	const result = await node.catch((error: { stdout?: string; code?: number }) => ({
		stdout: error.stdout ?? "",
		code: error.code ?? 1,
	}));
	const out = result.stdout ?? "";

	check(
		"the process was never signalled and stopped on its own",
		out.includes("DENIED"),
		out.trim().split("\n").pop(),
	);
	check(
		"because its next effect was refused",
		out.includes("revoked"),
		out.match(/DENIED.*/)?.[0]?.slice(0, 60),
	);
	check(
		"and it was refused before doing anything, not after",
		!existsSync(`${SANDBOX}/step-12.txt`),
	);

	// 5. It is in the log, as prominently as a use.
	console.log("\n5. The refusal is recorded");
	const denials = (await read(pool)).filter((e) => e.type === "capability.denied");
	check("the denial is in the log", denials.length > 0, `${denials.length}`);
	check(
		"naming the worker that was stopped",
		denials.some((d) => d.actor === "worker:a"),
	);
	const revocations = (await read(pool)).filter((e) => e.type === "capability.revoked");
	check("and so is every revocation", revocations.length === 4, `${revocations.length}`);
	check(
		"each saying why",
		revocations.every((r) => String(r.payload.reason).includes("emergency stop")),
	);

	// 6. What the stop does not do.
	console.log("\n6. What it does not do");
	check(
		"the work already done is still on disk, because a stop undoes nothing",
		existsSync(`${SANDBOX}/step-1.txt`),
	);
	check("but nothing new was written after it", !existsSync(`${SANDBOX}/step-9.txt`));

	// 7. The stop stays stopped.
	console.log("\n7. The stop stays stopped until somebody lifts it");
	let grantRefused = "";
	try {
		await grant(pool, {
			holder: "worker:d",
			resource: "filesystem",
			operations: ["write"],
			scope: SANDBOX,
			effectClass: "idempotent",
			checkpoint: "none",
			approval: "none",
			delegationDepth: 0,
			grantedBy: "human:ash",
		});
	} catch (error: unknown) {
		grantRefused = error instanceof Error ? error.message : String(error);
	}
	check("granting anything at all is refused while stopped", grantRefused.length > 0);
	check(
		"and it says the system is stopped rather than failing obscurely",
		grantRefused.includes("Maschina is stopped"),
		grantRefused.slice(0, 60),
	);
	check("so nothing is live", (await liveCapabilities(pool)).length === 0);

	// The hole this closes: before, the next grant quietly minted a fresh root
	// and the system was running again with nobody having decided to restart it.
	console.log("\n8. Restarting is deliberate, and recorded");
	const newRoot = await liftEmergencyStop(pool, "human:ash", "the proof is finished");
	check("lifting it produces a new root", newRoot.status === "active");
	check("which is not the old one", newRoot.id !== root.id);
	const lifts = (await read(pool)).filter((e) => e.type === "emergency_stop.lifted");
	check("and who lifted it, and why, is in the log", lifts.length === 1);
	check("naming the person", lifts[0]?.actor === "human:ash", String(lifts[0]?.actor));

	check(
		"nothing revoked came back with it",
		(await liveCapabilities(pool)).every((c) => !caps.map((x) => x.id).includes(c.id)),
	);

	// 9. Revocation is terminal. There is no undo, and no way to re-grant into it.
	console.log("\n9. The stop cannot be undone by appending to the log");
	await grant(pool, {
		holder: "worker:a",
		resource: "filesystem",
		operations: ["write"],
		scope: SANDBOX,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	}).catch(() => undefined);
	const stillDead = await getCapability(pool, caps[0]?.id ?? "");
	check("the revoked capability stays revoked", stillDead?.status === "revoked");
	check(
		"and a new grant does not resurrect the old authority",
		(await liveCapabilities(pool)).every((c) => !caps.map((x) => x.id).includes(c.id)),
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Slice 8 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
