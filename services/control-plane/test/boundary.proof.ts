/**
 * Slice 2 and 3 proof. Two processes, a real network boundary between them.
 *
 * Slice 3, STAGE_0_PLAN:
 *
 *   "Two processes in two terminals. Slice 2's effect still works. Stop the
 *    control plane and confirm the node makes no progress rather than
 *    proceeding unsupervised."
 *
 * Slice 2, which now runs over the wire rather than against the database:
 *
 *   "A file appears on disk in the sandbox. The log shows Decision, Intent,
 *    Outcome. Attempt to write outside the scope and confirm the denial is
 *    recorded as prominently as a use. Kill the process between Intent and
 *    Outcome and confirm the Intent is in the log with no Outcome."
 *
 * Advances proof criteria 2, 3 and 7 in `14-ROADMAP` §4.
 *
 * Run: pnpm proof
 */

import { execFile } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { appPool, grant, read, revoke } from "@maschina/db";
import {
	ControlPlaneUnreachable,
	EFFECT_INTENDED,
	EFFECT_OUTCOME,
	filesystemExecutor,
	httpControlPlane,
	performEffect,
	WORKER_DECIDED,
} from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const SANDBOX = "/tmp/maschina-slice2-sandbox";
const OUTSIDE = "/tmp/maschina-slice2-escaped.txt";
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

async function main(): Promise<void> {
	await resetLog();
	rmSync(SANDBOX, { recursive: true, force: true });
	rmSync(OUTSIDE, { force: true });
	mkdirSync(SANDBOX, { recursive: true });

	const pool = appPool();

	// The control plane, as a real server on a real port. The worker below
	// reaches it the same way a node on another machine would.
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	console.log("\nSlice 2 and 3: bounded authority across a real network boundary\n");

	// 1. A capability is granted, and it is a held object with every field set.
	console.log("1. Authority is a held object, not a permission lookup");
	const cap = await grant(pool, {
		holder: "worker:w1",
		resource: "filesystem",
		operations: ["write", "create"],
		scope: SANDBOX,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check("granted, and active", cap.status === "active");
	check("scoped to the sandbox", cap.scope === SANDBOX);
	check("operations enumerated, not a wildcard", cap.operations.join(",") === "write,create");
	check("effect class declared", cap.effectClass === "idempotent");
	check("delegation bounded", cap.delegationDepth === 0);
	check("limits are three numbers", cap.limits.granted === 0 && cap.limits.reserved === 0);

	// 2. The effect actually happens, in the real world.
	console.log("\n2. A real file, under bounded authority");
	const target = `${SANDBOX}/hello.txt`;
	const content = "Maschina wrote this under bounded authority.\n";
	const done = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "slice 2 hardcoded effect" },
		{ capabilityId: cap.id, operation: "write", target, payload: { content } },
		"idempotent",
		filesystemExecutor,
	);
	check("the effect was performed", done.performed);
	check("the file exists on disk", existsSync(target));
	check("with the right bytes", existsSync(target) && readFileSync(target, "utf8") === content);

	// 3. Decision, Intent, Outcome, in that order, causally linked.
	console.log("\n3. Decision, Intent, Outcome");
	const events = await read(pool);
	const decided = events.find((e) => e.type === WORKER_DECIDED);
	const intent = events.find((e) => e.type === EFFECT_INTENDED);
	const outcome = events.find((e) => e.type === EFFECT_OUTCOME);
	check("a decision was recorded", decided !== undefined);
	check("an intent was recorded", intent !== undefined);
	check("an outcome was recorded", outcome !== undefined);
	check(
		"the intent precedes the outcome",
		intent !== undefined && outcome !== undefined && intent.id < outcome.id,
	);
	check("the intent is caused by the decision", intent?.causation === decided?.id);
	check("the outcome is caused by the intent", outcome?.causation === intent?.id);
	check("the outcome says it succeeded", outcome?.payload.result === "succeeded");
	check("the intent names the capability used", intent?.payload.capabilityId === cap.id);

	// 4. Scope. The one that matters.
	console.log("\n4. Outside the scope is refused, and nothing reaches disk");
	const escapeAttempt = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "try to escape the sandbox" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: `${SANDBOX}/../maschina-slice2-escaped.txt`,
			payload: { content: "should never exist" },
		},
		"idempotent",
		filesystemExecutor,
	);
	check("refused", !escapeAttempt.performed);
	check(
		"because it is outside the scope",
		!escapeAttempt.performed && escapeAttempt.reason === "outside_scope",
		escapeAttempt.performed ? "" : escapeAttempt.reason,
	);
	check("and nothing was written outside", !existsSync(OUTSIDE));

	// 5. Denials are recorded as prominently as uses.
	console.log("\n5. The denial is recorded as prominently as a use");
	const after = await read(pool);
	const denials = after.filter((e) => e.type === "capability.denied");
	check("a denial event exists", denials.length === 1);
	check("it names who tried", denials[0]?.actor === "worker:w1");
	check("it names the target", denials[0]?.payload.target !== undefined);
	check("it explains why", String(denials[0]?.payload.detail).includes("outside"));
	check(
		"a denied use produced no Intent, because it never became an attempt",
		after.filter((e) => e.type === EFFECT_INTENDED).length === 1,
	);

	// 6. An operation that was never granted.
	console.log("\n6. An operation outside the grant is refused");
	const del = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "try to delete" },
		{ capabilityId: cap.id, operation: "delete", target, payload: {} },
		"idempotent",
		filesystemExecutor,
	);
	check("refused", !del.performed);
	check(
		"because delete was never granted",
		!del.performed && del.reason === "operation_not_granted",
	);
	check("the file is still there", existsSync(target));

	// 6b. A symlink is inside the scope as a string and points anywhere.
	console.log("\n6b. A symlink at the target is refused");
	const lure = `${SANDBOX}/lure.txt`;
	symlinkSync(OUTSIDE, lure);
	const viaSymlink = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "write through a symlink" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: lure,
			payload: { content: "escaped through a link" },
		},
		"idempotent",
		filesystemExecutor,
	);
	check(
		"authorization passes, because the path is inside the scope",
		viaSymlink.performed,
		"the scope check is pure and cannot see the link",
	);
	check(
		"but the write fails rather than following it",
		viaSymlink.performed && viaSymlink.result === "failed",
	);
	check("and nothing was written outside", !existsSync(OUTSIDE));
	check("the symlink is still just a symlink", lstatSync(lure).isSymbolicLink());
	const symlinkOutcome = (await read(pool)).filter((e) => e.type === EFFECT_OUTCOME).at(-1);
	check(
		"the log says it was refused as a symlink, not as a disk error",
		String(JSON.stringify(symlinkOutcome?.payload)).includes("symlink"),
	);

	// 7. Revocation takes effect before the next use, not eventually.
	console.log("\n7. Revocation works immediately");
	await revoke(pool, cap.id, "human:ash", "proof: emergency stop rehearsal");
	const afterRevoke = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "write after revocation" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: `${SANDBOX}/after.txt`,
			payload: { content: "nope" },
		},
		"idempotent",
		filesystemExecutor,
	);
	check("refused", !afterRevoke.performed);
	check("because it was revoked", !afterRevoke.performed && afterRevoke.reason === "revoked");
	check("and nothing was written", !existsSync(`${SANDBOX}/after.txt`));

	// 8. The crash window, now with a process boundary between the two halves.
	console.log("\n8. Killed between Intent and Outcome, across the boundary");
	const cap2 = await grant(pool, {
		holder: "worker:doomed",
		resource: "filesystem",
		operations: ["write"],
		scope: SANDBOX,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const before = (await read(pool)).length;

	// Async, deliberately. The control plane is serving on this process's event
	// loop, so a blocking spawn would stop it answering the very requests the
	// child is making, and the child would hang waiting for a server that cannot
	// reply until the child exits. That deadlock is the whole reason a node and
	// a control plane are separate processes in the first place.
	const child = fileURLToPath(new URL("./crash-child.ts", import.meta.url));
	let died = false;
	try {
		await promisify(execFile)("node", [
			"--import",
			"tsx",
			child,
			BASE,
			cap2.id,
			`${SANDBOX}/doomed.txt`,
		]);
	} catch {
		died = true;
	}
	check("the node process was killed", died);

	const post = await read(pool);
	const doomedIntents = post.filter(
		(e) => e.type === EFFECT_INTENDED && e.actor === "worker:doomed",
	);
	const doomedOutcomes = post.filter(
		(e) => e.type === EFFECT_OUTCOME && e.actor === "worker:doomed",
	);
	check("its Intent is in the log", doomedIntents.length === 1);
	check("with no Outcome", doomedOutcomes.length === 0);
	check("the log grew, so the write-ahead happened before the crash", post.length > before);
	check("the effect never reached disk", !existsSync(`${SANDBOX}/doomed.txt`));
	check(
		"the Intent records the effect class, so recovery can classify it",
		doomedIntents[0]?.payload.effectClass === "idempotent",
	);
	check(
		"the record survived the process that wrote it",
		doomedIntents[0]?.actor === "worker:doomed",
	);

	// 9. The boundary is real, and the node depends on it.
	console.log("\n9. With the control plane stopped, the node makes no progress");
	const logBeforeOutage = (await read(pool)).length;
	await new Promise<void>((resolve) => server.close(() => resolve()));

	let refusedToProceed = false;
	let unreachable = false;
	let reason = "";
	try {
		await performEffect(
			node,
			{
				worker: "worker:w1",
				objective: null,
				reasoning: "work while the control plane is down",
			},
			{
				capabilityId: cap2.id,
				operation: "write",
				target: `${SANDBOX}/unsupervised.txt`,
				payload: { content: "written without supervision" },
			},
			"idempotent",
			filesystemExecutor,
		);
	} catch (error: unknown) {
		refusedToProceed = true;
		// The type, not the wording. Matching on the message would pass for any
		// error that happened to contain the phrase, and fail the day someone
		// rewords it, which is the wrong sensitivity in both directions.
		unreachable = error instanceof ControlPlaneUnreachable;
		reason = error instanceof Error ? error.message : String(error);
	}

	check("the worker stopped rather than proceeding", refusedToProceed);
	check(
		"and said why, rather than failing obscurely",
		unreachable && reason.includes("control plane could not be reached"),
		reason,
	);
	check(
		"nothing was written unsupervised",
		!existsSync(`${SANDBOX}/unsupervised.txt`),
		"06-NODES open question 4: the honest default is no",
	);
	check(
		"and nothing was recorded, because nothing could be",
		(await read(pool)).length === logBeforeOutage,
	);

	await pool.end();
	verdict("Slice 2 and 3 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
