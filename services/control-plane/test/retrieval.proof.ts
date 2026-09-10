/**
 * Stage 1, slice 6 proof. Retrieval, with recorded scores.
 *
 * `STAGE_1_PLAN` slice 6:
 *
 *   "Answer 'why did the worker see this and not that' from the log, the way
 *    slice 10's seven questions are answered: by asking, not by reading code."
 *
 *   "Watch for: retrieval that cannot be audited. A score nobody records is a
 *    number nobody can argue with."
 *
 * `07-CONTEXT-MEMORY` §6 gives the reason this matters: when a worker decides
 * badly, we need to know whether it retrieved the wrong things or reasoned badly
 * about the right ones, and those have completely different fixes.
 *
 * Run: pnpm proof
 */

import { appPool, read, remember, retrieve, whyThatContext } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";

const WORKER = "worker:reader";
const PROJECT = "project:x";

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nStage 1 slice 6: why the worker saw this and not that\n");

	// A memory with several things in it, differing in all three signals.
	console.log("1. Several things worth remembering, differing in every signal");
	const solid = await remember(pool, {
		kind: "knowledge",
		content: "deployments fail when the migration lock is held",
		origin: "asserted_by_human",
		evidence: ["human:ash said so"],
		confidence: 1,
		scope: "project",
		scopeId: PROJECT,
		author: "human:ash",
		fromUntrusted: false,
	});
	const guess = await remember(pool, {
		kind: "lesson",
		content: "deployments always fail on a friday",
		origin: "inferred",
		evidence: ["event:7"],
		confidence: 0.3,
		scope: "project",
		scopeId: PROJECT,
		author: "worker:a",
		fromUntrusted: false,
	});
	const unrelated = await remember(pool, {
		kind: "knowledge",
		content: "the icons are stored as inline svg",
		origin: "asserted_by_worker",
		evidence: ["event:9"],
		confidence: 0.8,
		scope: "project",
		scopeId: PROJECT,
		author: "worker:b",
		fromUntrusted: false,
	});
	const hidden = await remember(pool, {
		kind: "lesson",
		content: "deployments fail because the migration lock is never released",
		origin: "inferred",
		evidence: ["event:11"],
		confidence: 0.9,
		scope: "worker",
		// Belongs to a different worker, so this one may not see it however
		// relevant it is.
		scopeId: "worker:somebody-else",
		author: "worker:somebody-else",
		fromUntrusted: false,
	});
	check("four things were written down", [solid, guess, unrelated, hidden].every(Boolean));

	// 2. Retrieval, with everything scored.
	console.log("\n2. Retrieving for a decision, and scoring everything considered");
	const result = await retrieve(pool, {
		worker: WORKER,
		objective: null,
		project: PROJECT,
		query: "why do deployments fail",
		options: { take: 2 },
	});

	check("something was selected", result.selected.length === 2, `${result.selected.length}`);
	check(
		"and more was considered than selected",
		result.considered.length > result.selected.length,
		`${result.considered.length} considered`,
	);

	// 3. Scope is applied before scoring, not as a signal.
	console.log("\n3. Scope decides visibility before relevance gets a say");
	check(
		"the most relevant thing in the database was never a candidate",
		!result.considered.some((c) => c.record.id === hidden),
		"it belongs to another worker",
	);
	check(
		"which is the contamination defence still holding through retrieval",
		result.considered.every((c) => c.record.id !== hidden),
	);

	// 4. No single signal decided.
	console.log("\n4. The stated fact outranks the more colourful guess");
	const top = result.considered[0];
	check(
		"the confirmed fact came first",
		top?.record.id === solid,
		top?.record.content.slice(0, 40),
	);
	const guessScore = result.considered.find((c) => c.record.id === guess);
	check(
		"the guess scored lower despite being about the same subject",
		(guessScore?.score ?? 1) < (top?.score ?? 0),
		`${guessScore?.score} vs ${top?.score}`,
	);
	check(
		"and the components say why: reliability, not relevance",
		(guessScore?.reliability ?? 1) < (top?.reliability ?? 0),
		`reliability ${guessScore?.reliability} vs ${top?.reliability}`,
	);

	// 5. The unrelated one lost on relevance, and the log says so.
	console.log("\n5. The unrelated one lost on relevance, specifically");
	const irrelevant = result.considered.find((c) => c.record.id === unrelated);
	check("it was considered", irrelevant !== undefined);
	check("and not selected", irrelevant?.selected === false);
	check(
		"having scored zero on relevance rather than on trust",
		irrelevant?.relevance === 0 && (irrelevant?.reliability ?? 0) > 0,
		`relevance ${irrelevant?.relevance}, reliability ${irrelevant?.reliability}`,
	);

	// 6. The whole ranking is in the log, losers included.
	console.log("\n6. The ranking is in the log, including what it rejected");
	const recorded = await whyThatContext(pool, WORKER);
	check("the retrieval was recorded", recorded.length === 1);
	check("with what was being decided", recorded[0]?.query === "why do deployments fail");
	check(
		"and how relevance was measured, so the ranking can be re-read",
		recorded[0]?.scorer === "shared-words",
		recorded[0]?.scorer ?? "",
	);
	check(
		"every candidate is there, not only the chosen ones",
		recorded[0]?.ranking.length === result.considered.length,
		`${recorded[0]?.ranking.length} entries`,
	);
	check(
		"each with its three components, not just a total",
		(recorded[0]?.ranking ?? []).every(
			(r) =>
				typeof r.relevance === "number" &&
				typeof r.recency === "number" &&
				typeof r.reliability === "number",
		),
	);
	check(
		"and whether it made the cut",
		(recorded[0]?.ranking ?? []).filter((r) => r.selected).length === 2,
	);

	// 7. The question, answered by asking.
	console.log("\n7. Why did the worker see this and not that?");
	const ranking = recorded[0]?.ranking ?? [];
	const winner = ranking.find((r) => r.memoryId === solid);
	const loser = ranking.find((r) => r.memoryId === unrelated);
	console.log(
		`    chose    ${solid.slice(0, 12)}  score ${winner?.score}  ` +
			`relevance ${winner?.relevance} recency ${winner?.recency} reliability ${winner?.reliability}`,
	);
	console.log(
		`    rejected ${unrelated.slice(0, 12)}  score ${loser?.score}  ` +
			`relevance ${loser?.relevance} recency ${loser?.recency} reliability ${loser?.reliability}`,
	);
	check(
		"the answer is in the log, with the numbers that produced it",
		winner !== undefined && loser !== undefined && winner.score > loser.score,
	);
	check(
		"and it says which signal made the difference",
		(winner?.relevance ?? 0) > (loser?.relevance ?? 0),
		"relevance, and the numbers show it rather than somebody asserting it",
	);

	// 8. It is all events, like everything else.
	console.log("\n8. Retrieval is an event, like everything else");
	const events = (await read(pool)).filter((e) => e.type === "memory.retrieved");
	check("the retrieval is in the log as an event", events.length === 1);
	check(
		"carrying the ranking rather than a summary of it",
		Array.isArray((events[0]?.payload as { ranking?: unknown[] } | undefined)?.ranking),
	);

	await pool.end();
	verdict("Stage 1 slice 6 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
