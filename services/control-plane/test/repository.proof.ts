/**
 * Slice 6 proof. Effect classes, reconciliation, and the checkpoint procedure.
 *
 * STAGE_0_PLAN slice 6:
 *
 *   "A commit appears on a real remote. Then crash between Intent and Outcome on
 *    the push, restart, and confirm reconciliation queries the remote and either
 *    records the missing Outcome or re-executes, without duplicating the commit.
 *    Do the same for the class 1 filesystem effect and confirm it re-executes
 *    cleanly. Then crash with uncommitted edits in the working tree and confirm
 *    the checkpoint procedure preserved them, or that their loss is recorded
 *    rather than silent."
 *
 *   "Watch for: the credential reaching the worker process. Grep for it."
 *
 * Advances criteria 3 and 5, and closes C1.
 *
 * This one touches a real remote. It targets a throwaway repository per
 * `ADR-002` §3, never this one.
 *
 * Run: pnpm proof:live
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	appPool,
	checkpointWorkspace,
	foldWorkspaces,
	grant,
	openWorkspace,
	read,
	recordWorkspaceLost,
} from "@maschina/db";
import {
	filesystemExecutor,
	httpControlPlane,
	performEffect,
	recover,
	resolutionFor,
} from "@maschina/worker";
import { check, listen, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";
import { reconcile } from "../src/repository.ts";

const REPO = "maschina-labs/maschina-sandbox";
const SANDBOX = "/tmp/maschina-slice6-sandbox";
const run = promisify(execFile);

// Module scoped because the helpers above `main` need it, and the port is not
// known until the server is listening.
let BASE = "";
const child = fileURLToPath(new URL("./repo-child.ts", import.meta.url));

/** Each run gets its own branch, so reruns cannot see each other's commits. */
const RUN = `maschina/proof-${Date.now()}`;

async function node(
	mode: string,
	capabilityId: string,
	tag: string,
): Promise<{ code: number; out: string }> {
	// The credential, removed. A worker that went looking finds nothing.
	const env = { ...process.env };
	delete env.SSH_AUTH_SOCK;
	try {
		const { stdout } = await run(
			"node",
			["--import", "tsx", child, BASE, mode, "worker:committer", capabilityId, REPO, RUN, tag],
			{ env },
		);
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
	const server = await listen(createApp(pool).fetch);
	BASE = server.base;

	console.log("\nSlice 6: effect classes, reconciliation, and the checkpoint procedure\n");

	const repoCap = await grant(pool, {
		holder: "worker:committer",
		resource: "repository",
		operations: ["commit"],
		scope: REPO,
		effectClass: "reconcilable",
		// This capability creates no working tree: the broker clones into a
		// temporary directory and deletes it. Nothing survives on the node, so
		// there is nothing to checkpoint, and saying `commit` here would declare
		// a procedure for state that does not exist.
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check(
		"the capability is class 2, because a push can end up unknown",
		repoCap.effectClass === "reconcilable",
	);
	check("scoped to the throwaway repository, not this one", repoCap.scope === REPO);
	check("and it declares what happens to local state", repoCap.checkpoint === "none");

	// 1. The ordinary case: a commit appears on a real remote.
	console.log("1. A commit appears on a real remote");
	const cleanTag = `clean-${Date.now()}`;
	const clean = await node("clean", repoCap.id, cleanTag);
	check("the node finished", clean.code === 0, `exit ${clean.code}`);
	const landed = await reconcile(REPO, RUN, cleanTag);
	check("and the commit is on the remote", landed !== null, String(landed).slice(0, 7));

	// 2. The credential never reached the worker.
	console.log("\n2. The credential never reached the worker process");
	check(
		"the node reported no agent socket in its own environment",
		clean.out.includes("SSH_AUTH_SOCK=(absent)"),
		clean.out.split("\n")[0],
	);
	const workerSource = readdirSync("packages/worker/src")
		.filter((f) => f.endsWith(".ts"))
		.map((f) => readFileSync(`packages/worker/src/${f}`, "utf8"))
		.join("\n");
	// One pattern rather than a substring check per thing. The substring version
	// of the second half was flagged by CodeQL as incomplete URL sanitisation,
	// and although the taint was wrong (this greps source text, not a URL) the
	// complaint underneath it was right: `includes` on a host name is weak
	// evidence that survives no refactor at all.
	const CREDENTIAL_OR_REMOTE =
		/SSH_AUTH_SOCK|GIT_ASKPASS|GH_TOKEN|GITHUB_TOKEN|ssh-agent|id_ed25519|github\.com|\bgit@/;
	check(
		"nothing in the worker package mentions a credential or a remote",
		!CREDENTIAL_OR_REMOTE.test(workerSource),
		CREDENTIAL_OR_REMOTE.exec(workerSource)?.[0] ?? "",
	);
	check(
		"and it holds no git machinery at all, so there is nothing to leak into",
		!/child_process|execFile|spawn\(/.test(workerSource),
	);

	// 3. Crash after the push landed. Reconciliation must not duplicate it.
	console.log("\n3. Crash after the push landed: reconciliation records, it does not repeat");
	const afterTag = `after-${Date.now()}`;
	const after = await node("after", repoCap.id, afterTag);
	check("the node died", after.code === 137, `exit ${after.code}`);
	check("after pushing", after.out.includes("pushed"), after.out.trim().split("\n").pop());

	const crashState = recover(await read(pool, { objective: "obj_slice6" }));
	const stranded = crashState.unfinished.filter((u) => u.operation === "commit");
	check("the log has an Intent with no Outcome", stranded.length === 1);
	check(
		"and its class says to ask the world rather than guess",
		resolutionFor(stranded[0]?.effectClass ?? "") === "reconcile",
		stranded[0]?.effectClass,
	);

	const asked = await reconcile(REPO, RUN, afterTag);
	check("asking the remote finds the commit", asked !== null, String(asked).slice(0, 7));

	const commitsAfter = await commitCount(afterTag);
	check(
		"and there is exactly one of it, not two",
		commitsAfter === 1,
		`${commitsAfter} commit(s)`,
	);

	// 4. Crash before the push. Reconciliation must say so, and it re-executes.
	console.log("\n4. Crash before the push: reconciliation finds nothing, and it re-runs");
	const beforeTag = `before-${Date.now()}`;
	const before = await node("before", repoCap.id, beforeTag);
	check("the node died", before.code === 137, `exit ${before.code}`);
	check("without pushing", !before.out.includes("pushed"));

	const missing = await reconcile(REPO, RUN, beforeTag);
	check("the remote says it never happened", missing === null);

	const rerun = await node("clean", repoCap.id, beforeTag);
	check("so re-executing is safe, and it worked", rerun.code === 0, `exit ${rerun.code}`);
	const commitsBefore = await commitCount(beforeTag);
	check("producing exactly one commit", commitsBefore === 1, `${commitsBefore} commit(s)`);

	// 5. The class 1 effect re-executes cleanly.
	console.log("\n5. A class 1 effect re-executes cleanly");
	const fileCap = await grant(pool, {
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
	const target = `${SANDBOX}/retried.txt`;
	const crashChild = fileURLToPath(new URL("./crash-child.ts", import.meta.url));

	try {
		await run("node", ["--import", "tsx", crashChild, BASE, fileCap.id, target]);
	} catch {
		// Expected: it kills itself between the Intent and the Outcome.
	}

	const fsState = recover(await read(pool, { actor: "worker:doomed" }));
	check(
		"the filesystem effect is caught in the crash window too",
		fsState.unfinished.length === 1,
	);
	check("and nothing reached disk", !existsSync(target));
	check(
		"its class says retry, with no question asked of the world",
		resolutionFor(fsState.unfinished[0]?.effectClass ?? "") === "retry",
		fsState.unfinished[0]?.effectClass,
	);

	// The retry, for real, rather than an assertion about what a retry would be.
	const content = "written on the second attempt\n";
	const retried = await performEffect(
		httpControlPlane(BASE),
		{ worker: "worker:doomed", objective: null, reasoning: "retrying after the crash" },
		{ capabilityId: fileCap.id, operation: "write", target, payload: { content } },
		"idempotent",
		filesystemExecutor,
	);
	check("re-executing it worked", retried.performed && retried.result === "succeeded");
	check("the file is on disk now", existsSync(target));
	check("with the right bytes", existsSync(target) && readFileSync(target, "utf8") === content);
	check(
		"and repeating an idempotent effect changed nothing the second time",
		readdirSync(SANDBOX).filter((f) => f === "retried.txt").length === 1,
	);
	check(
		"unsafe would have escalated instead, because nothing can be asked",
		resolutionFor("unsafe") === "escalate",
	);
	check(
		"and an unrecognised class escalates rather than being assumed harmless",
		resolutionFor("invented-later") === "escalate",
	);

	// 6. The checkpoint procedure, and what it means when there is none.
	console.log("\n6. Work in progress on a node, and what survives losing it");
	const treeCap = await grant(pool, {
		holder: "worker:editor",
		resource: "repository",
		operations: ["commit"],
		scope: REPO,
		effectClass: "reconcilable",
		// This one does hold a working tree, so it must say how the work gets off
		// the machine. Checkpointing happens as it works, not during recovery:
		// the tree is on the dead node's disk and recovery runs somewhere else.
		checkpoint: "commit",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check(
		"a capability holding a working tree declares how it is preserved",
		treeCap.checkpoint === "commit",
	);

	const treePath = `${tmpdir()}/maschina-wip-${Date.now()}`;
	await openWorkspace(pool, "worker:editor", treeCap.id, treePath, "node:a", 0n);
	let trees = foldWorkspaces(await read(pool, { actor: "worker:editor" }));
	check(
		"an open workspace with nothing saved yet is visible in the log",
		trees[0]?.checkpoint === null,
	);
	check(
		"which is the state where a crash loses everything",
		trees[0]?.checkpoint === null && trees[0]?.lost === false,
	);

	await checkpointWorkspace(pool, "worker:editor", treePath, "deadbeef", RUN, 0n);
	trees = foldWorkspaces(await read(pool, { actor: "worker:editor" }));
	check(
		"after a checkpoint the work is on a remote and named in the log",
		trees[0]?.checkpoint === "deadbeef",
	);

	// The node dies. Nobody can reach its disk. What is left is what was pushed.
	await recordWorkspaceLost(pool, "worker:editor", treePath, "the node died", 0n);
	trees = foldWorkspaces(await read(pool, { actor: "worker:editor" }));
	check("losing the node is recorded, not silent", trees[0]?.lost === true);
	check(
		"and the checkpoint survives it, because that work already left the machine",
		trees[0]?.checkpoint === "deadbeef",
	);

	const losses = (await read(pool)).filter((e) => e.type === "workspace.lost");
	check("the loss is an event anyone can find, not an absence", losses.length === 1);
	check(
		"saying which workspace and why",
		String(losses[0]?.payload.path) === treePath &&
			String(losses[0]?.payload.reason).length > 0,
		String(losses[0]?.payload.reason),
	);

	// 7. The mechanical half of A1: judge against what the executor cannot fake.
	console.log("\n7. Evaluation checks the world, not the executor's report");
	const claimed = (await read(pool, { objective: "obj_slice6" }))
		.filter((e) => e.type === "effect.outcome" && e.payload.operation === "commit")
		.map((e) => ((e.payload.detail ?? {}) as Record<string, unknown>).commit)
		.filter((c): c is string => typeof c === "string");
	check("the executor reported at least one commit", claimed.length > 0, `${claimed.length}`);

	// The verdict comes from the remote, not from the line above. `ADR-004` and
	// `09-EVALUATION` §4: if the node reporting "it worked" is the node under
	// suspicion, its report is the weakest evidence available, not the strongest.
	const fromTheWorld = await reconcile(REPO, RUN, cleanTag);
	check(
		"and the remote confirms it independently",
		fromTheWorld !== null,
		String(fromTheWorld).slice(0, 7),
	);
	check(
		"the two agree, which is what makes the criterion mechanical",
		fromTheWorld !== null && claimed.includes(fromTheWorld),
	);

	// The case that matters: a claim with nothing behind it.
	const fabricated = await reconcile(REPO, RUN, "an-intent-nobody-ever-ran");
	check(
		"a claim the world does not support returns nothing, rather than being believed",
		fabricated === null,
	);
	check(
		"so an executor cannot satisfy a mechanical criterion by reporting that it did",
		fabricated === null && fromTheWorld !== null,
	);

	// A1's other half, which Stage 0 cannot satisfy and does not pretend to.
	console.log(
		"      A1 placement: one node at Stage 0, so evaluation runs where execution did.",
	);
	console.log("      Recorded in ADR-004. The substantive half is checked above.");

	await server.close();
	await pool.end();
	verdict("Slice 6 proof");
}

/** How many commits on the run branch carry this tag. Asked of the remote. */
async function commitCount(tag: string): Promise<number> {
	const dir = `${tmpdir()}/maschina-count-${Date.now()}`;
	try {
		await run("git", [
			"clone",
			"--depth",
			"50",
			"--branch",
			RUN,
			`git@github.com:${REPO}.git`,
			dir,
		]);
		const { stdout } = await run("git", ["-C", dir, "log", "--format=%B", "-n", "50"]);
		return stdout.split(`Maschina-Intent: ${tag}`).length - 1;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
