/**
 * The first real objective. The Stage 0 completion demonstration.
 *
 * `STAGE_0_PLAN`, "The first real objective": run once all eleven slices pass.
 *
 *   Objective:  Add a CONTRIBUTING.md to the throwaway repository describing the
 *               commit message convention used in that repository.
 *
 *   Contract:   CONTRIBUTING.md exists on the remote     mechanical
 *               It documents the convention actually used  independent
 *               non-goals: no other file, no CI changes
 *
 * Every slice proved one mechanism on its own. This is the first time they have
 * to work together: a worker reads the world, decides what to do, acts through a
 * broker it holds no credential for, and is judged by a different worker that
 * cannot accept its own work.
 *
 * **Costs no money.** The only model provider is the local CLI on a
 * subscription, and no API key exists anywhere in the system, so there is no
 * billing path to reach. The numbers below are list value: what the tokens are
 * worth, not money charged. `ADR-009` §3.
 *
 * Defaults to the `fast` class rather than `reasoning`, which the plan names.
 * The plan's budget of two dollars assumes a paid key; on a subscription the
 * cheaper class costs a fraction of a cent of list value and demonstrates
 * exactly the same composition. Pass `--class reasoning` to run it as written.
 *
 * Run: pnpm first-objective
 */

import { serve } from "@hono/node-server";
import type { Contract, ModelClass, Verdict } from "@maschina/core";
import { hashContract } from "@maschina/core";
import {
	appPool,
	evaluationsOf,
	getObjective,
	grant,
	listCapabilities,
	read,
	stateObjective,
	whatDidItCost,
} from "@maschina/db";
import type { ControlPlane } from "@maschina/worker";
import {
	evaluationExecutor,
	httpControlPlane,
	modelExecutor,
	performEffect,
	repositoryExecutor,
} from "@maschina/worker";
import type { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { fileExistsOnRemote, fileOnRemote } from "../src/history.ts";

const REPO = "maschina-labs/maschina-sandbox";
const BRANCH = "main";
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const EXECUTOR = "worker:author";
const JUDGE = "worker:reviewer";

const modelClass: ModelClass = process.argv.includes("--class")
	? ((process.argv[process.argv.indexOf("--class") + 1] ?? "fast") as ModelClass)
	: "fast";

const CONTRACT: Contract = {
	criteria: [
		{
			id: "exists",
			criterion: "CONTRIBUTING.md exists on the remote default branch",
			verifyBy: "query the git remote for the file at HEAD",
			strength: "mechanical",
			evidence: ["the file, read back from the remote"],
		},
		{
			id: "documents",
			criterion: "It documents the commit convention actually used in the history",
			verifyBy: "a worker that did not do the work reads the commits and the file",
			strength: "independent",
			evidence: ["the commit subjects", "the file contents"],
		},
	],
	nonGoals: ["changes to any other file", "changes to CI"],
	failureConditions: ["the repository is left in a broken state"],
};

let step = 0;
function say(what: string): void {
	step++;
	console.log(`\n[${step}] ${what}`);
}

async function main(): Promise<void> {
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	// Everything below runs inside a try that always closes the server. Without
	// it, a throw left the server listening, the event loop never emptied, and
	// the process sat there for an hour instead of printing the error. The error
	// was one line and correct; only the reporting was broken.
	try {
		await demonstrate(pool, node);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

async function demonstrate(pool: Pool, node: ControlPlane): Promise<void> {
	console.log("\nThe first real objective\n");
	console.log(`  repository: ${REPO}`);
	console.log(`  model class: ${modelClass}`);
	console.log("  cost: subscription usage. No key exists, so nothing can be billed.\n");

	// A previous run, or a proof, may have left the system stopped. That is the
	// emergency stop working, not a fault, and it deserves saying so rather than
	// failing on the first grant with a stack trace.
	const stopped = (await listCapabilities(pool)).some(
		(c) => c.holder === "root" && c.parent === null && c.status === "revoked",
	);
	const running = (await listCapabilities(pool)).some(
		(c) => c.holder === "root" && c.parent === null && c.status === "active",
	);
	if (stopped && !running) {
		console.log("Maschina is stopped. Something revoked the root and nobody lifted it.\n");
		console.log("  maschina denied            shows what has been refused since");
		console.log("  and lifting it is deliberate: see liftEmergencyStop in @maschina/db.\n");
		return;
	}

	// ── The objective, with an agreement about what done means ────────────────
	say("Stating the objective, with a contract that is frozen once admitted");
	const admitted = await stateObjective(pool, {
		statement:
			"Add a CONTRIBUTING.md to the sandbox repository describing the commit " +
			"message convention actually used in its history.",
		contract: CONTRACT,
		origin: "human:ash",
		constraints: { maxSteps: 20 },
	});
	if (admitted.problems.length > 0) {
		console.error("The contract was refused:", admitted.problems.join("; "));
		process.exitCode = 1;
		return;
	}
	const objective = admitted.objective;
	const frozen = hashContract(CONTRACT);
	console.log(`    ${objective.id}, contract frozen at ${frozen.slice(0, 12)}`);

	// ── Authority, bounded, and less than the human has ───────────────────────
	say("Granting exactly what the work needs, and nothing else");
	const repoCap = await grant(pool, {
		holder: EXECUTOR,
		resource: "repository",
		operations: ["commit"],
		scope: REPO,
		effectClass: "reconcilable",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const brain = await grant(pool, {
		holder: EXECUTOR,
		resource: "model",
		operations: ["invoke"],
		scope: modelClass,
		// Two dollars of list value, as the plan specifies. It will use a sliver.
		limits: { granted: 2_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	console.log(`    ${EXECUTOR} may commit to ${REPO} and invoke a ${modelClass} model`);
	console.log("    it may not write anywhere else, and holds no credential for either");

	// ── Read the world before acting ──────────────────────────────────────────
	say("Reading the repository, because the answer depends on what is there");
	const history = (await (
		await fetch(
			`${BASE}/repository/history?capabilityId=${repoCap.id}&holder=${EXECUTOR}&repository=${REPO}&count=20`,
		)
	).json()) as { subjects?: string[] };
	const subjects = history.subjects ?? [];
	console.log(`    ${subjects.length} commit subject(s) read from the remote`);
	for (const subject of subjects.slice(0, 5)) console.log(`      ${subject}`);

	// ── The worker decides ────────────────────────────────────────────────────
	say("Asking the model what the file should say, as a recorded, metered effect");
	const prompt =
		"Here are the recent commit subjects from a git repository:\n\n" +
		subjects.map((s) => `  ${s}`).join("\n") +
		"\n\nWrite a short CONTRIBUTING.md, in markdown, documenting the commit " +
		"message convention these subjects actually follow. Describe only what the " +
		"subjects show. Do not invent rules they do not demonstrate, and do not " +
		"mention anything other than commit messages. Reply with the file contents " +
		"and nothing else.";

	const decided = await performEffect(
		node,
		{ worker: EXECUTOR, objective: objective.id, reasoning: "decide what the file should say" },
		{ capabilityId: brain.id, operation: "invoke", target: modelClass, payload: { prompt } },
		"idempotent",
		modelExecutor(node, EXECUTOR),
	);
	if (!decided.performed || decided.result !== "succeeded") {
		console.error("    the model call did not succeed:", JSON.stringify(decided));
		process.exitCode = 1;
		return;
	}
	const content = String(decided.detail.text ?? "").trim();
	console.log(`    ${String(decided.detail.model)} answered, ${content.length} characters`);
	console.log(
		`    cost so far: ${(Number(decided.detail.cost) / 1_000_000).toFixed(6)} of list value`,
	);

	// ── Act on it, through a broker holding the credential ────────────────────
	say("Committing it, without the worker ever seeing a credential");
	const intent = (await read(pool, { objective: objective.id }))
		.filter((e) => e.type === "effect.intended")
		.at(-1);

	const committed = await performEffect(
		node,
		{ worker: EXECUTOR, objective: objective.id, reasoning: "put the file on the remote" },
		{
			capabilityId: repoCap.id,
			operation: "commit",
			target: REPO,
			payload: {
				branch: BRANCH,
				path: "CONTRIBUTING.md",
				content: `${content}\n`,
				intentId: `first-objective-${intent?.id ?? Date.now()}`,
			},
		},
		"reconcilable",
		repositoryExecutor(node, EXECUTOR),
	);
	if (!committed.performed || committed.result !== "succeeded") {
		console.error("    the commit did not succeed:", JSON.stringify(committed));
		process.exitCode = 1;
		return;
	}
	console.log(`    ${String(committed.detail.commit).slice(0, 12)} on ${BRANCH}`);

	// ── Judgment, by somebody who did not do the work ─────────────────────────
	say("A second worker judges it, and cannot be the one that did it");
	const judgeCap = await grant(pool, {
		holder: JUDGE,
		resource: "objective",
		operations: ["evaluate"],
		scope: objective.id,
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const judgeBrain = await grant(pool, {
		holder: JUDGE,
		resource: "model",
		operations: ["invoke"],
		scope: modelClass,
		limits: { granted: 1_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	// Criterion 1: mechanical, and asked of the world rather than of the worker.
	const exists = await fileExistsOnRemote(REPO, BRANCH, "CONTRIBUTING.md");
	const onRemote = await fileOnRemote(REPO, BRANCH, "CONTRIBUTING.md");
	console.log(`    mechanical: the remote ${exists ? "has" : "does not have"} the file`);

	// Criterion 2: judgment, by a worker that reads the same evidence.
	const judgePrompt =
		"A repository's recent commit subjects:\n\n" +
		subjects.map((s) => `  ${s}`).join("\n") +
		"\n\nAnd a CONTRIBUTING.md that claims to document their convention:\n\n" +
		(onRemote ?? "(the file could not be read)") +
		"\n\nDoes the file accurately describe the convention the subjects actually " +
		"follow? Answer with exactly one word: SATISFIED, NOT_SATISFIED, or " +
		"INDETERMINATE if you cannot tell from what you were given.";

	const judged = await performEffect(
		node,
		{ worker: JUDGE, objective: objective.id, reasoning: "read the evidence and decide" },
		{
			capabilityId: judgeBrain.id,
			operation: "invoke",
			target: modelClass,
			payload: { prompt: judgePrompt },
		},
		"idempotent",
		modelExecutor(node, JUDGE),
	);
	const answer = String(judged.performed ? judged.detail.text : "").toUpperCase();
	const judgement: Verdict["result"] = answer.includes("NOT_SATISFIED")
		? "not_satisfied"
		: answer.includes("SATISFIED")
			? "satisfied"
			: "indeterminate";
	console.log(`    judgment: ${judgement}`);

	const verdicts: Verdict[] = [
		{
			criterionId: "exists",
			result: exists ? "satisfied" : "not_satisfied",
			evidence: [`${REPO}@${BRANCH}:CONTRIBUTING.md`],
			method: "mechanical",
			notes: "read from the remote, not from anything the executor reported",
		},
		{
			criterionId: "documents",
			result: judgement,
			evidence: ["the commit subjects", "the file as it is on the remote"],
			method: "independent",
			notes: answer.slice(0, 120),
		},
	];

	await performEffect(
		node,
		{ worker: JUDGE, objective: objective.id, reasoning: "record the verdict" },
		{
			capabilityId: judgeCap.id,
			operation: "evaluate",
			target: objective.id,
			payload: { contractHash: frozen, verdicts },
		},
		"idempotent",
		evaluationExecutor(node, JUDGE),
	);

	// ── What happened, asked rather than asserted ─────────────────────────────
	say("What the log says, asked the way anybody would ask it");
	const finalObjective = await getObjective(pool, objective.id);
	const evaluation = (await evaluationsOf(pool, objective.id)).at(-1);
	const costs = await whatDidItCost(pool, objective.id);
	const events = await read(pool, { objective: objective.id });

	console.log(`    objective:   ${finalObjective?.state}`);
	console.log(`    rollup:      ${evaluation?.rollup}`);
	console.log(`    remaining:   ${evaluation?.remaining.join(", ") || "nothing"}`);
	console.log(`    events:      ${events.length}`);
	for (const cost of costs) {
		console.log(
			`    ${cost.resource.padEnd(11)} ${(cost.settled / 1_000_000).toFixed(6)} over ${cost.calls} call(s)`,
		);
	}
	console.log(`\n    maschina cost ${objective.id}`);
	console.log(`    maschina log --objective ${objective.id}`);
	console.log("    show the whole thing, from the log, with nothing hidden.\n");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
