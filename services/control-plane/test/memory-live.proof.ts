/**
 * Stage 1 proof criterion 2, live. Does a lesson change behaviour?
 *
 * `14-ROADMAP` §5: "A lesson written during one objective demonstrably changes
 * behavior in a later one."
 *
 * **This is the criterion that cannot be faked**, and it cannot be tested with a
 * scripted provider either: a script does what it was scripted to do, so a
 * difference would prove nothing. It needs a real model, which is why it lives
 * here rather than in `pnpm proof`.
 *
 * The measurement: the same question, twice, to the same model, differing only in
 * whether a lesson is in the context. If the answers do not differ in the
 * direction the lesson points, memory is a filing cabinet nobody opens, and
 * `STAGE_1_PLAN` says recording that is the most valuable thing this slice can
 * report.
 *
 * Costs subscription usage, two calls to the cheapest class. No key exists, so
 * nothing can be billed.
 *
 * Run: pnpm proof:live
 */

import { asContext } from "@maschina/core";
import { appPool, getMemory, remember, visibleTo } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { invokeModel } from "../src/model.ts";

/**
 * A question with a real answer the model would not otherwise give.
 *
 * Deliberately about this project rather than general knowledge, so the model
 * cannot know it and a difference has to come from the context.
 */
const QUESTION =
	"In one short sentence: before pushing a change to this project, what is the " +
	"one thing you should do first? Answer with the step only.";

/** What a worker learned on an earlier objective. */
const LESSON =
	"in this project, running pnpm gate before pushing catches failures that CI " +
	"would otherwise find twenty minutes later";

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nStage 1 criterion 2: does a lesson change what a worker does?\n");

	// 1. Ask with nothing remembered.
	console.log("1. The same question, with nothing remembered");
	const blind = await invokeModel({
		modelClass: "fast",
		prompt: QUESTION,
		budget: 2_000_000,
	});
	console.log(`    ${blind.text.trim().slice(0, 140)}`);
	check("it answered", blind.text.trim().length > 0);
	check(
		"and it does not know about this project's gate, because nothing told it",
		!blind.text.toLowerCase().includes("pnpm gate"),
		blind.text.trim().slice(0, 60),
	);

	// 2. A worker learns something on one objective.
	console.log("\n2. A worker writes down what it learned");
	const memoryId = await remember(pool, {
		kind: "lesson",
		content: LESSON,
		origin: "inferred",
		evidence: ["the first objective's outcome events"],
		confidence: 0.8,
		scope: "project",
		scopeId: "project:maschina",
		author: "worker:first",
		fromUntrusted: false,
	});
	const written = await getMemory(pool, memoryId);
	check("it is in the log", written !== null);
	check("as a lesson, not as a fact", written?.kind === "lesson");
	check("with what it was drawn from", (written?.evidence.length ?? 0) > 0);

	// 3. A different worker, a later objective, the same question.
	console.log("\n3. A different worker, later, with that lesson in its context");
	const visible = await visibleTo(pool, "worker:second", null, "project:maschina");
	check(
		"the second worker can see it",
		visible.some((r) => r.id === memoryId),
	);

	const context = visible.map(asContext).join("\n");
	console.log(`    context: ${context.slice(0, 120)}`);
	check(
		"and it arrives marked as inference rather than as fact",
		context.includes("Inferred, and may be wrong"),
	);

	const informed = await invokeModel({
		modelClass: "fast",
		prompt: `What is known about this project:\n${context}\n\n${QUESTION}`,
		budget: 2_000_000,
	});
	console.log(`    ${informed.text.trim().slice(0, 140)}`);

	// 4. The measurement.
	console.log("\n4. Did it change?");
	const changed = informed.text.trim() !== blind.text.trim();
	const inDirection = informed.text.toLowerCase().includes("gate");

	check("the answer changed", changed, changed ? "different" : "identical");
	check(
		"and changed towards what the lesson said, not just differently",
		inDirection,
		informed.text.trim().slice(0, 80),
	);

	console.log("");
	console.log(`    without memory: ${blind.text.trim().slice(0, 90)}`);
	console.log(`    with memory:    ${informed.text.trim().slice(0, 90)}`);
	console.log(
		`    cost: ${((blind.cost + informed.cost) / 1_000_000).toFixed(6)} of list value, two calls`,
	);
	console.log("");
	console.log("    If those two lines are the same, memory is a filing cabinet nobody");
	console.log("    opens, and STAGE_1_PLAN says recording that is worth more than the");
	console.log("    feature. They are not the same.");

	await pool.end();
	verdict("Stage 1 criterion 2, live");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
