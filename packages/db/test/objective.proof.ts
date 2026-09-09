/**
 * Slice 1 proof. STAGE_0_PLAN, slice 1:
 *
 *   "State an objective with a contract. Confirm it is admitted and the contract
 *    hash is recorded. Attempt to modify the contract of an active objective and
 *    confirm it is refused."
 *
 *   "Watch for: admitting an objective without a contract. That path must not
 *    exist."
 *
 * Advances proof criterion 1 in 14-ROADMAP §4.
 *
 * Run: pnpm proof
 */

import type { Contract } from "@maschina/core";
import { hashContract } from "@maschina/core";
import { appPool } from "../src/client.ts";
import { read } from "../src/log.ts";
import {
	amendContract,
	get,
	list,
	OBJECTIVE_ADMITTED,
	OBJECTIVE_AMENDMENT_REFUSED,
	OBJECTIVE_REJECTED,
	OBJECTIVE_STATED,
	stateObjective,
} from "../src/objective.ts";
import { check, resetLog, verdict } from "./harness.ts";

const GOOD: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "CONTRIBUTING.md exists on the remote default branch",
			verifyBy: "query the git remote for the file at HEAD",
			strength: "mechanical",
			evidence: ["the file at HEAD on origin"],
		},
		{
			id: "c2",
			criterion: "It documents the convention actually used in the history",
			verifyBy: "an evaluator reads the last 20 commits and the file",
			strength: "independent",
			evidence: ["the diff", "the last 20 commit subjects"],
		},
	],
	nonGoals: ["no changes to any other file", "no changes to CI"],
	failureConditions: ["the repository has no commit history to describe"],
};

const VAGUE = {
	criteria: [
		{
			id: "c1",
			criterion: "Make the code better",
			verifyBy: "",
			strength: "vibes",
			evidence: [],
		},
	],
	nonGoals: [],
	failureConditions: [],
} as unknown as Contract;

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nSlice 1: objectives with a frozen contract\n");

	// 1. Admission
	console.log("1. A stated objective with a real contract is admitted");
	const { objective, problems } = await stateObjective(pool, {
		statement: "Add a CONTRIBUTING to the throwaway repository",
		contract: GOOD,
		origin: "human:ash",
		constraints: { maxSteps: 20, wallClockSeconds: 1800 },
	});
	check("no problems reported", problems.length === 0, problems.join("; "));
	check("state is admitted", objective.state === "admitted", objective.state);
	check("statement preserved", objective.statement.startsWith("Add a CONTRIBUTING"));
	check("constraints preserved", objective.constraints.maxSteps === 20);
	check("origin is the human", objective.origin === "human:ash");

	// 2. The freeze
	console.log("\n2. The contract is hashed at admission");
	check("a hash was recorded", objective.contractHash !== null);
	check(
		"the hash is the hash of the contract that was admitted",
		objective.contractHash === hashContract(GOOD),
	);
	const admittedEvents = await read(pool, { objective: objective.id });
	const admitted = admittedEvents.find((e) => e.type === OBJECTIVE_ADMITTED);
	check("the hash is in the log, not only in the projection", admitted !== undefined);
	check(
		"the logged hash matches",
		String(admitted?.payload.contractHash) === hashContract(GOOD),
	);
	check(
		"admission is caused by the statement",
		admitted?.causation === admittedEvents.find((e) => e.type === OBJECTIVE_STATED)?.id,
	);

	// 3. The gate
	console.log("\n3. A contract that says nothing checkable is refused");
	const refused = await stateObjective(pool, {
		statement: "Improve things",
		contract: VAGUE,
		origin: "human:ash",
	});
	check("state is rejected", refused.objective.state === "rejected", refused.objective.state);
	check("no hash was frozen", refused.objective.contractHash === null);
	check("problems were reported", refused.problems.length >= 3);
	check(
		"the rejection is in the log",
		(await read(pool, { objective: refused.objective.id })).some(
			(e) => e.type === OBJECTIVE_REJECTED,
		),
	);
	check(
		"the reasons are in the log, not just on screen",
		refused.objective.rejectedReason?.includes("verifyBy") === true,
	);

	// 4. The freeze holds
	console.log("\n4. The target cannot move");
	let threw = false;
	try {
		await amendContract(
			pool,
			objective.id,
			{ ...GOOD, criteria: [GOOD.criteria[0] as Contract["criteria"][number]] },
			"worker:eager",
		);
	} catch {
		threw = true;
	}
	check("amending an admitted contract throws", threw);

	const after = await get(pool, objective.id);
	check("the frozen hash is unchanged", after?.contractHash === hashContract(GOOD));
	check("the state is unchanged", after?.state === "admitted");
	check(
		"the contract itself is unchanged",
		after?.contract.criteria.length === GOOD.criteria.length,
	);

	console.log("\n5. The refusal is recorded as prominently as a use");
	const events = await read(pool, { objective: objective.id });
	const refusal = events.find((e) => e.type === OBJECTIVE_AMENDMENT_REFUSED);
	check("a refusal event exists", refusal !== undefined);
	check("it records who tried", refusal?.actor === "worker:eager");
	check("it records the frozen hash", refusal?.payload.frozenHash === hashContract(GOOD));
	check(
		"it records what they tried to change it to",
		typeof refusal?.payload.attemptedHash === "string" &&
			refusal.payload.attemptedHash !== hashContract(GOOD),
	);

	// 6. The projection
	console.log("\n6. Objectives are a projection, not a table");
	const tables = await pool.query<{ table_name: string }>(
		"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
	);
	const names = tables.rows.map((r) => r.table_name);
	check(
		"the only table is events",
		names.length === 1 && names[0] === "events",
		names.join(", "),
	);
	const all = await list(pool);
	check("both objectives fold out of the log", all.length === 2, `got ${all.length}`);
	check(
		"folding twice gives the same answer",
		JSON.stringify(await list(pool)) === JSON.stringify(all),
	);

	await pool.end();
	verdict("Slice 1 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
