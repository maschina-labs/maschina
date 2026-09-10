/**
 * Stage 1, slice 7 proof. Progress, and criterion 3.
 *
 * `STAGE_1_PLAN` slice 7, and `14-ROADMAP` §5's third criterion:
 *
 *   "Give a worker an objective it cannot complete and confirm it stops within N
 *    steps with a question a human can answer in one reply. Confirm a criterion
 *    satisfied early is recorded then, not rediscovered at the end."
 *
 *   "Watch for: 'stuck' being defined as 'took too long'. `03-RUNTIME` §8 is
 *    about progress and thrashing, not about a clock."
 *
 * So the proof spends as much effort showing what does **not** stall as what
 * does. A system that stops careful work for being slow is worse than one that
 * never stops anything, because it punishes exactly the behaviour it wants.
 *
 * Run: pnpm proof
 */

import type { Contract } from "@maschina/core";
import {
	appPool,
	getSuspension,
	progressOf,
	read,
	recordStep,
	satisfiedWhen,
	stateObjective,
	suspendIfStalled,
} from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";

const CRITERIA = ["exists", "documented", "deployed"];

const CONTRACT: Contract = {
	criteria: CRITERIA.map((id) => ({
		id,
		criterion: `the ${id} condition holds`,
		verifyBy: "look at it",
		strength: "mechanical" as const,
		evidence: ["the output"],
	})),
	nonGoals: [],
	failureConditions: [],
};

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nStage 1 slice 7: getting somewhere, and knowing when you are not\n");

	// 1. A criterion met early is recorded then.
	console.log("1. A criterion satisfied at step two is recorded at step two");
	const working = (
		await stateObjective(pool, {
			statement: "An objective that makes progress",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;

	await recordStep(pool, "worker:busy", working.id, {
		artifacts: [],
		observations: ["the target directory is empty"],
		changedTheWorld: false,
		satisfied: [],
	});
	await recordStep(pool, "worker:busy", working.id, {
		artifacts: ["out.txt"],
		observations: [],
		changedTheWorld: true,
		satisfied: ["exists"],
	});

	const met = await satisfiedWhen(pool, working.id);
	check("the criterion is recorded as met", met.length === 1);
	check("naming which one", met[0]?.criterionId === "exists", met[0]?.criterionId ?? "");
	check(
		"at the moment it happened rather than at the end",
		met[0]?.step !== undefined,
		`event ${met[0]?.step}`,
	);

	const partial = await progressOf(pool, working.id);
	check("progress knows what is done", partial.satisfied.join(",") === "exists");
	check("and how many steps it took", partial.steps === 2, `${partial.steps}`);
	check("with nothing stalled", partial.consecutiveNulls === 0);

	// 2. Slow is not stuck.
	console.log("\n2. Twenty careful steps is work, not a stall");
	for (let i = 0; i < 20; i++) {
		await recordStep(pool, "worker:busy", working.id, {
			artifacts: [],
			observations: [`checked approach ${i} and it will not work because of the lock`],
			changedTheWorld: false,
			satisfied: [],
		});
	}
	const slow = await progressOf(pool, working.id);
	check("twenty two steps in", slow.steps === 22, `${slow.steps}`);
	check("and nothing is stalled", slow.consecutiveNulls === 0);
	const notStalled = await suspendIfStalled(
		pool,
		"worker:busy",
		working.id,
		CRITERIA,
		"checking approaches",
	);
	check("so it was not suspended", !notStalled);
	check(
		"because a step that learned something is progress, even a failed one",
		(await getSuspension(pool, "worker:busy")) === null,
	);

	// 3. An objective it cannot finish.
	console.log("\n3. An objective it cannot finish stops within three steps");
	const impossible = (
		await stateObjective(pool, {
			statement: "An objective nothing can satisfy",
			contract: CONTRACT,
			origin: "human:ash",
		})
	).objective;

	let suspendedAt = 0;
	for (let step = 1; step <= 6; step++) {
		await recordStep(pool, "worker:stuck", impossible.id, {
			artifacts: [],
			observations: [],
			changedTheWorld: false,
			satisfied: [],
		});
		if (
			await suspendIfStalled(
				pool,
				"worker:stuck",
				impossible.id,
				CRITERIA,
				"asking for a capability it does not hold",
			)
		) {
			suspendedAt = step;
			break;
		}
	}

	check("it stopped", suspendedAt > 0);
	check("within three steps, not eventually", suspendedAt === 3, `at step ${suspendedAt}`);
	check(
		"and it did not keep going to six",
		(await progressOf(pool, impossible.id)).steps === 3,
	);

	// 4. The question, which is the criterion.
	console.log("\n4. And asked something answerable in one reply");
	const waiting = await getSuspension(pool, "worker:stuck");
	check("it is waiting on a person", waiting?.kind === "question", waiting?.kind);

	const question = waiting?.question ?? "";
	console.log(`\n    ${question}\n`);
	check("there is a question", question.length > 0);
	check("it ends in a question mark, because it is one", question.trim().endsWith("?"));
	check(
		"it names which criteria are unmet",
		question.includes("exists") && question.includes("documented"),
		"names the remaining work",
	);
	check(
		"it says what was last tried, so nobody has to guess",
		question.includes("capability it does not hold"),
	);
	check(
		"and it is not merely a report that something is stuck",
		!question.toLowerCase().startsWith("the worker is stuck"),
	);

	check(
		"why it stopped is recorded separately from what it is asking",
		(waiting?.reason ?? "").includes("no artifact, no observation") &&
			!(waiting?.reason ?? "").includes("?"),
		waiting?.reason ?? "",
	);

	// 5. It is all in the log.
	console.log("\n5. Every step is in the log, not counted in memory");
	const events = await read(pool, { objective: impossible.id });
	check(
		"each step is an event",
		events.filter((e) => e.type === "step.completed").length === 3,
	);
	check(
		"and the suspension is too",
		events.some((e) => e.type === "worker.suspended"),
	);
	check(
		"so a restarted worker sees the same stall, rather than starting the count over",
		(await progressOf(pool, impossible.id)).consecutiveNulls === 3,
	);

	await pool.end();
	verdict("Stage 1 slice 7 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
