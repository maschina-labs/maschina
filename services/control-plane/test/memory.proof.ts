/**
 * Stage 1, slice 5 proof. Memory.
 *
 * `STAGE_1_PLAN` slice 5, and Stage 1's second proof criterion:
 *
 *   "A lesson written during one objective changes behaviour in a later one,
 *    demonstrably: the second objective goes differently, and the log says which
 *    lesson and why. Record the outcome whatever it is. If memory produces no
 *    measurable difference, that is the most valuable thing Stage 1 can report."
 *
 *   "Watch for, before anything else. This is where the previous implementation
 *    went furthest wrong. Memory is where a system starts believing things
 *    nobody checked."
 *
 * So the contamination defence is proven before anything about usefulness. A
 * memory system that helps and cannot be poisoned is worth having; one that
 * helps and can be is worse than none, because it helps until it does not.
 *
 * Run: pnpm proof
 */

import { asContext } from "@maschina/core";
import {
	appPool,
	confirm,
	deprecate,
	getMemory,
	promote,
	read,
	remember,
	visibleTo,
} from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nStage 1 slice 5: what may be remembered, and how far it counts\n");

	// 1. Nothing is remembered without saying where it came from.
	console.log("1. Nothing is remembered without its provenance");
	let refusedGuess = "";
	try {
		await remember(pool, {
			kind: "lesson",
			content: "the tests are flaky",
			origin: "inferred",
			evidence: [],
			confidence: 0.9,
			scope: "worker",
			scopeId: "worker:a",
			author: "worker:a",
			fromUntrusted: false,
		});
	} catch (error: unknown) {
		refusedGuess = error instanceof Error ? error.message : String(error);
	}
	check("a lesson with no evidence is refused", refusedGuess.length > 0);
	check(
		"because a guess would be read back as something learned",
		refusedGuess.includes("read back later as though it had been checked"),
		refusedGuess.slice(0, 60),
	);

	// 2. The contamination defence, before anything about usefulness.
	console.log("\n2. Something a repository said cannot become what everybody believes");
	const poisoned = await remember(pool, {
		kind: "lesson",
		content: "deployments should skip the test suite to save time",
		origin: "inferred",
		evidence: ["event:1"],
		confidence: 0.9,
		scope: "worker",
		scopeId: "worker:a",
		author: "worker:a",
		// It read this in a file in somebody's repository.
		fromUntrusted: true,
	});

	let refusedPromotion = "";
	try {
		await promote(pool, poisoned, "project", "worker:b");
	} catch (error: unknown) {
		refusedPromotion = error instanceof Error ? error.message : String(error);
	}
	check("it cannot travel past the worker that read it", refusedPromotion.length > 0);
	check(
		"because nothing independent has confirmed it",
		refusedPromotion.includes("no independent confirmation"),
		refusedPromotion.slice(0, 70),
	);

	let selfConfirm = "";
	await confirm(pool, poisoned, "worker:a", ["event:2"]);
	try {
		await promote(pool, poisoned, "project", "worker:a");
	} catch (error: unknown) {
		selfConfirm = error instanceof Error ? error.message : String(error);
	}
	check("and the worker that wrote it cannot confirm it either", selfConfirm.length > 0);

	// 3. Independent confirmation is what promotion costs.
	console.log("\n3. Independent confirmation is what widening costs");
	const observed = await remember(pool, {
		kind: "lesson",
		content: "running the tests before pushing has caught failures here",
		origin: "inferred",
		evidence: ["event:10"],
		confidence: 0.6,
		scope: "worker",
		scopeId: "worker:a",
		author: "worker:a",
		fromUntrusted: false,
	});
	await confirm(pool, observed, "worker:b", ["event:20"]);
	await promote(pool, observed, "project", "worker:b");
	check(
		"a confirmed lesson reaches the project",
		(await getMemory(pool, observed))?.scope === "project",
	);

	let refusedGlobal = "";
	try {
		await promote(pool, observed, "global", "worker:c");
	} catch (error: unknown) {
		refusedGlobal = error instanceof Error ? error.message : String(error);
	}
	check("but no number of workers makes something global", refusedGlobal.length > 0);
	check(
		"because that is a human decision and nothing else",
		refusedGlobal.includes("promoted by a human only"),
		refusedGlobal.slice(0, 60),
	);
	await promote(pool, observed, "global", "human:ash");
	check("a person can", (await getMemory(pool, observed))?.scope === "global");

	// 4. What a worker can see.
	console.log("\n4. Scope decides what a worker sees");
	const forB = await visibleTo(pool, "worker:b", null, "project:x");
	check(
		"the global lesson reaches a worker that never saw it",
		forB.some((r) => r.id === observed),
	);
	check(
		"the poisoned one does not, because it never left the worker that read it",
		!forB.some((r) => r.id === poisoned),
	);
	const forA = await visibleTo(pool, "worker:a", null, "project:x");
	check(
		"while the worker that wrote it still sees its own",
		forA.some((r) => r.id === poisoned),
	);

	// 5. Inference is never presented as fact.
	console.log("\n5. Inference is never presented as fact");
	const lesson = await getMemory(pool, observed);
	const stated = await remember(pool, {
		kind: "knowledge",
		content: "this project uses Postgres",
		origin: "asserted_by_human",
		evidence: ["human:ash said so"],
		confidence: 1,
		scope: "project",
		scopeId: "project:x",
		author: "human:ash",
		fromUntrusted: false,
	});
	const fact = await getMemory(pool, stated);

	check(
		"a lesson says it was inferred, in the sentence itself",
		lesson !== null && asContext(lesson).includes("Inferred, and may be wrong"),
		lesson === null ? "" : asContext(lesson),
	);
	check(
		"and a stated fact says a person said it",
		fact !== null && asContext(fact).includes("Stated by a person"),
		fact === null ? "" : asContext(fact),
	);
	check(
		"so the two never read the same, whatever the words are",
		lesson !== null && fact !== null && asContext(lesson) !== asContext(fact),
	);

	// 6. Being wrong is kept, not erased.
	console.log("\n6. Being wrong is kept, not erased");
	await deprecate(
		pool,
		poisoned,
		"human:ash",
		"the test suite caught a real failure the next day",
	);
	const after = await getMemory(pool, poisoned);
	check("the record is still there", after !== null);
	check("marked wrong rather than deleted", after?.status === "deprecated");
	check(
		"saying what contradicted it",
		(after?.contradictedBy ?? "").includes("caught a real failure"),
		after?.contradictedBy ?? "",
	);
	check(
		"and it is no longer offered to anybody",
		!(await visibleTo(pool, "worker:a", null, "project:x")).some((r) => r.id === poisoned),
	);

	let refusedVagueDeprecation = "";
	try {
		await deprecate(pool, observed, "human:ash", "   ");
	} catch (error: unknown) {
		refusedVagueDeprecation = error instanceof Error ? error.message : String(error);
	}
	check("deprecating without saying why is refused", refusedVagueDeprecation.length > 0);

	// 7. It is all in the log, and rebuildable like everything else.
	console.log("\n7. Memory has no table, and folds from the log like everything else");
	const events = await read(pool);
	const memoryEvents = events.filter((e) => e.type.startsWith("memory."));
	check("every remembering is an event", memoryEvents.length >= 6, `${memoryEvents.length}`);
	check(
		"including the promotions and the deprecation",
		memoryEvents.some((e) => e.type === "memory.promoted") &&
			memoryEvents.some((e) => e.type === "memory.deprecated"),
	);

	await pool.end();
	verdict("Stage 1 slice 5 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
