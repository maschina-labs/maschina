/**
 * Slice 7 proof. Evaluation.
 *
 * STAGE_0_PLAN slice 7:
 *
 *   "The evaluator returns a per-criterion verdict. The executing worker
 *    attempts to mark its own objective accomplished and is denied, and the
 *    denial is in the log. Force an indeterminate verdict and confirm the
 *    objective suspends rather than rounding to success or failure."
 *
 * Advances criterion 6.
 *
 * The mechanical half, verifying against world state the executor does not
 * control, is in `repository.proof.ts` because it needs a real remote to query.
 * Everything here needs nothing, so it runs in CI.
 *
 * **A known limitation, recorded rather than solved.** `ADR-004` and amendment
 * A1 require that evaluation not run on the node that executed. Stage 0 has one
 * node, so the placement half cannot be satisfied here and is not claimed to be.
 * The substantive half, that judgment is held by a different worker and verified
 * against evidence the executor does not control, is proven below and in
 * `repository.proof.ts` §7.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import type { Contract, Verdict } from "@maschina/core";
import { hashContract } from "@maschina/core";
import {
	appPool,
	authorize,
	evaluationsOf,
	getObjective,
	grant,
	read,
	recordEvaluation,
	stateObjective,
} from "@maschina/db";
import { httpControlPlane, performEffect } from "@maschina/worker";
import { check, verdict as report, resetLog } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8795;
const BASE = `http://127.0.0.1:${PORT}`;
const SANDBOX = "/tmp/maschina-slice7-sandbox";

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "the output file exists with the agreed contents",
			verifyBy: "read the file and compare",
			strength: "mechanical",
			evidence: ["the file contents"],
		},
		{
			id: "c2",
			criterion: "the work is reachable by someone other than the worker",
			verifyBy: "query the remote",
			strength: "mechanical",
			evidence: ["the commit hash from the remote"],
		},
	],
	nonGoals: ["anything outside the sandbox"],
	failureConditions: ["the sandbox is left in a broken state"],
};

const aVerdict = (id: string, result: Verdict["result"], notes = ""): Verdict => ({
	criterionId: id,
	result,
	evidence: [`evidence for ${id}`],
	method: "mechanical",
	notes,
});

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	console.log("\nSlice 7: execution completed is not objective accomplished\n");

	const admitted = await stateObjective(pool, {
		statement: "Write the output file and get it somewhere else",
		contract: CONTRACT,
		origin: "human:ash",
	});
	const objective = admitted.objective;
	const frozen = hashContract(CONTRACT);
	check("the objective was admitted with a frozen contract", admitted.problems.length === 0);

	// 1. The executor does some work. Completing it proves nothing.
	console.log("1. A worker executes, which is not the same as succeeding");
	const cap = await grant(pool, {
		holder: "worker:executor",
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
		{ worker: "worker:executor", objective: objective.id, reasoning: "doing the work" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: `${SANDBOX}/out.txt`,
			payload: { content: "x" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);
	const afterWork = await getObjective(pool, objective.id);
	check(
		"the objective is not accomplished just because the worker finished",
		afterWork?.state !== "accomplished",
		afterWork?.state,
	);

	// 2. The worker cannot be given authority to judge its own objective.
	console.log("\n2. The executor cannot hold the authority to judge itself");
	let grantRefused = "";
	try {
		await grant(pool, {
			holder: "worker:executor",
			resource: "objective",
			operations: ["evaluate"],
			scope: objective.id,
			effectClass: "idempotent",
			checkpoint: "none",
			approval: "none",
			delegationDepth: 0,
			grantedBy: "human:ash",
		});
	} catch (error: unknown) {
		grantRefused = error instanceof Error ? error.message : String(error);
	}
	check("granting it was refused outright", grantRefused.length > 0);
	check(
		"because it worked on the objective, not for some other reason",
		grantRefused.includes("cannot be granted authority to judge it"),
		grantRefused.slice(0, 70),
	);
	check(
		"so the capability never exists, rather than existing and being refused",
		(await read(pool)).filter(
			(e) =>
				e.type === "capability.granted" &&
				e.payload.holder === "worker:executor" &&
				e.payload.resource === "objective",
		).length === 0,
	);

	// 3. A capability granted before the work still cannot be used after it.
	console.log("\n3. And one granted beforehand still cannot be used afterwards");
	const second = (
		await stateObjective(pool, {
			statement: "A second objective, judged by someone who later worked on it",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;
	// Granted while the holder is innocent. The grant-time check passes.
	const premature = await grant(pool, {
		holder: "worker:latecomer",
		resource: "objective",
		operations: ["evaluate"],
		scope: second.id,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check(
		"the grant succeeded, because at that moment it was legitimate",
		premature.status === "active",
	);

	// Then it does the work, which is what disqualifies it.
	await performEffect(
		node,
		{ worker: "worker:latecomer", objective: second.id, reasoning: "helping out" },
		{
			capabilityId: cap.id,
			operation: "write",
			target: `${SANDBOX}/out.txt`,
			payload: { content: "y" },
		},
		"idempotent",
		async () => ({ wrote: true }),
	);

	const useDenied = await authorize(pool, {
		capabilityId: premature.id,
		holder: "worker:latecomer",
		operation: "evaluate",
		target: second.id,
	});
	check("using it afterwards is denied", !useDenied.granted);
	check(
		"for judging its own work, and not for anything else",
		!useDenied.granted && useDenied.reason === "self_evaluation",
		useDenied.granted ? "" : useDenied.reason,
	);
	const denials = (await read(pool)).filter(
		(e) => e.type === "capability.denied" && e.payload.reason === "self_evaluation",
	);
	check("and the denial is in the log, as prominently as a use", denials.length === 1);

	// 4. A separate worker judges, per criterion.
	console.log("\n4. A different worker judges, one criterion at a time");
	const judgeCap = await grant(pool, {
		holder: "worker:judge",
		resource: "objective",
		operations: ["evaluate"],
		scope: objective.id,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check("the judge may evaluate, having done none of the work", judgeCap.status === "active");
	check(
		"and it holds no authority to change anything",
		!judgeCap.operations.some((o) => ["write", "create", "delete", "commit"].includes(o)),
		judgeCap.operations.join(","),
	);

	const partial = await recordEvaluation(pool, objective.id, "worker:judge", frozen, [
		aVerdict("c1", "satisfied"),
		aVerdict("c2", "not_satisfied", "nothing has left the machine yet"),
	]);
	check("the verdict is per criterion, not a single yes or no", partial.verdicts.length === 2);
	check("it rolled up as partial", partial.rollup === "partial");
	check(
		"which leaves the objective active with work remaining, not failed",
		(await getObjective(pool, objective.id))?.state === "active",
	);
	check(
		"and it says exactly what is left",
		partial.remaining.join(",") === "c2",
		partial.remaining.join(","),
	);

	// 5. Indeterminate suspends. It does not round.
	console.log("\n5. An indeterminate verdict suspends rather than rounding");
	const unsure = await recordEvaluation(pool, objective.id, "worker:judge", frozen, [
		aVerdict("c1", "satisfied"),
		aVerdict("c2", "indeterminate", "the remote could not be reached, so this is unknown"),
	]);
	check(
		"one criterion that cannot be judged makes the objective unjudged",
		unsure.rollup === "indeterminate",
	);
	const suspended = await getObjective(pool, objective.id);
	check("the objective suspended", suspended?.state === "suspended", suspended?.state);
	check("it was not rounded up to accomplished", suspended?.state !== "accomplished");
	check("nor rounded down to failed", suspended?.state !== "failed");
	check(
		"even though every other criterion was satisfied",
		unsure.verdicts.filter((v) => v.result === "satisfied").length === 1,
	);

	// 6. All satisfied, and only then.
	console.log("\n6. Accomplished only when every criterion is satisfied");
	const done = await recordEvaluation(pool, objective.id, "worker:judge", frozen, [
		aVerdict("c1", "satisfied"),
		aVerdict("c2", "satisfied"),
	]);
	check("the rollup is accomplished", done.rollup === "accomplished");
	check(
		"and the objective is",
		(await getObjective(pool, objective.id))?.state === "accomplished",
	);
	check(
		"the frozen contract is what was judged, and it did not move",
		done.contractHash === frozen &&
			(await getObjective(pool, objective.id))?.contractHash === frozen,
	);

	// 7. Every verdict is kept, so the history of judgment is auditable.
	console.log("\n7. Every verdict is kept, not just the last one");
	const history = await evaluationsOf(pool, objective.id);
	check("all three evaluations are in the log", history.length === 3, `${history.length}`);
	check(
		"in order, and the objective followed each one",
		history.map((h) => h.rollup).join(" -> ") === "partial -> indeterminate -> accomplished",
		history.map((h) => h.rollup).join(" -> "),
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	report("Slice 7 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
