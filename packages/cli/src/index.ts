/**
 * The Maschina CLI. 08-ENVIRONMENT §5: the CLI is not a lesser surface, it is a
 * forcing function. Anything it can do exists in the control plane, so a later
 * graphical surface cannot discover that half the capability lives in a UI.
 *
 * Scope so far: the event log, and objectives with a frozen contract.
 *
 * Argument parsing is done by hand. A CLI framework is not paid for by a named
 * problem yet (01-PRINCIPLES P12) and a handful of commands do not need one.
 */

import { readFile } from "node:fs/promises";
import type { Contract, NewEvent } from "@maschina/core";
import { validateContract } from "@maschina/core";
import {
	adminPool,
	amendContract,
	append,
	applySchema,
	appPool,
	getObjective,
	head,
	listObjectives,
	provenanceOf,
	read,
	stateObjective,
	whatCanWorkerDo,
	whatDidItCost,
	whatWasDenied,
	whatWasDoneWith,
	whatWouldRevoking,
	whyDidItDecide,
} from "@maschina/db";

const USAGE = `maschina, Stage 0

  db init                  create the events table and the app role
  event append             append one event to the log
    --actor <s>            required. which worker, node, or human
    --type <s>             required. what kind of fact this records
    --objective <s>        what this was in service of
    --payload <json>       defaults to {}
    --causation <id>       the event that caused this one
  objective state          state an objective and admit it if the contract holds
    --statement <s>        required. the intention, in prose
    --contract <path>      required. a JSON contract. No contract, no admission
    --origin <s>           who is stating it. defaults to human:local
  objective list           every objective and its state
  objective show <id>      one objective, folded from the log
  objective amend <id>     try to change a frozen contract. always refused
    --contract <path>      required. the contract that will not be accepted
  log                      print the stream in order
    --objective <s>        filter
    --actor <s>            filter
    --after <id>           only events after this id
    --limit <n>            cap the output
    --json                 one JSON object per line

  The seven questions. Answered by asking, not by reading the code.

  can <worker>             what this worker can do right now
  provenance <cap>         where this capability came from, all the way to root
  used <cap>               what has been done with this capability
  denied [holder]          what has been denied, and to whom
  blast <cap>              what would be revoked if you revoked this
  cost <objective>         what an objective cost, by resource
  why <event-id>           why the worker decided what it did

Everything is a projection over the log (02-CORE §7).`;

function parseFlags(argv: string[]): Map<string, string | true> {
	const flags = new Map<string, string | true>();
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined || !arg.startsWith("--")) continue;
		const name = arg.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith("--")) {
			flags.set(name, next);
			i++;
		} else {
			flags.set(name, true);
		}
	}
	return flags;
}

function requireString(flags: Map<string, string | true>, name: string): string {
	const value = flags.get(name);
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`--${name} is required`);
	}
	return value;
}

function optionalString(flags: Map<string, string | true>, name: string): string | undefined {
	const value = flags.get(name);
	return typeof value === "string" ? value : undefined;
}

async function dbInit(): Promise<void> {
	const pool = adminPool();
	try {
		await applySchema(pool);
		console.log("Schema applied. events is append-only, enforced twice:");
		console.log("  · maschina_app holds INSERT and SELECT only");
		console.log("  · UPDATE, DELETE and TRUNCATE raise for every role");
	} finally {
		await pool.end();
	}
}

async function eventAppend(flags: Map<string, string | true>): Promise<void> {
	const payloadRaw = optionalString(flags, "payload");
	let payload: Record<string, unknown> = {};
	if (payloadRaw !== undefined) {
		const parsed: unknown = JSON.parse(payloadRaw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error("--payload must be a JSON object");
		}
		payload = parsed as Record<string, unknown>;
	}

	const causationRaw = optionalString(flags, "causation");
	const objective = optionalString(flags, "objective");

	const event: NewEvent = {
		actor: requireString(flags, "actor"),
		type: requireString(flags, "type"),
		objective: objective ?? null,
		payload,
		causation: causationRaw !== undefined ? BigInt(causationRaw) : null,
	};

	const pool = appPool();
	try {
		const recorded = await append(pool, event);
		console.log(`Recorded event ${recorded.id}: ${recorded.type}`);
	} finally {
		await pool.end();
	}
}

async function logCommand(flags: Map<string, string | true>): Promise<void> {
	const limitRaw = optionalString(flags, "limit");
	const afterRaw = optionalString(flags, "after");
	const objective = optionalString(flags, "objective");
	const actor = optionalString(flags, "actor");

	const pool = appPool();
	try {
		const events = await read(pool, {
			...(objective !== undefined ? { objective } : {}),
			...(actor !== undefined ? { actor } : {}),
			...(afterRaw !== undefined ? { after: BigInt(afterRaw) } : {}),
			...(limitRaw !== undefined ? { limit: Number(limitRaw) } : {}),
		});

		if (flags.get("json") === true) {
			for (const event of events) {
				console.log(
					JSON.stringify(event, (_key, value: unknown) =>
						typeof value === "bigint" ? value.toString() : value,
					),
				);
			}
			return;
		}

		if (events.length === 0) {
			console.log("The log is empty.");
			return;
		}

		for (const event of events) {
			const when = event.recordedAt.toISOString();
			const parts = [String(event.id).padStart(4, " "), when, event.actor, event.type];
			if (event.objective !== null) parts.push(`objective=${event.objective}`);
			if (event.causation !== null) parts.push(`caused-by=${event.causation}`);
			const payload = JSON.stringify(event.payload);
			if (payload !== "{}") parts.push(payload);
			console.log(parts.join("  "));
		}

		const highest = await head(pool);
		console.log(`\n${events.length} event(s). Head is ${highest ?? "empty"}.`);
	} finally {
		await pool.end();
	}
}

async function readContract(path: string): Promise<Contract> {
	const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${path} must contain a JSON object`);
	}
	return parsed as Contract;
}

function printObjective(objective: {
	id: string;
	statement: string;
	state: string;
	origin: string;
	contractHash: string | null;
	rejectedReason: string | null;
	contract: Contract;
}): void {
	console.log(`${objective.id}`);
	console.log(`  statement  ${objective.statement}`);
	console.log(`  state      ${objective.state}`);
	console.log(`  origin     ${objective.origin}`);
	console.log(`  contract   ${objective.contractHash ?? "not frozen"}`);
	if (objective.rejectedReason !== null) {
		console.log(`  rejected   ${objective.rejectedReason}`);
	}
	for (const criterion of objective.contract.criteria ?? []) {
		console.log(`    - [${criterion.strength}] ${criterion.id}: ${criterion.criterion}`);
	}
}

async function objectiveState(flags: Map<string, string | true>): Promise<void> {
	const contract = await readContract(requireString(flags, "contract"));

	// Fail before touching the log if the contract is unusable. The log is
	// append-only, so a rejection recorded here is permanent, and there is no
	// reason to make a permanent record of a typo in a file path.
	const problems = validateContract(contract);

	const pool = appPool();
	try {
		const result = await stateObjective(pool, {
			statement: requireString(flags, "statement"),
			contract,
			origin: optionalString(flags, "origin") ?? "human:local",
		});

		printObjective(result.objective);
		if (problems.length > 0) {
			console.log("\nNot admitted:");
			for (const problem of result.problems) console.log(`  - ${problem}`);
			process.exitCode = 1;
		}
	} finally {
		await pool.end();
	}
}

async function objectiveList(): Promise<void> {
	const pool = appPool();
	try {
		const objectives = await listObjectives(pool);
		if (objectives.length === 0) {
			console.log("No objectives yet.");
			return;
		}
		for (const objective of objectives) {
			console.log(`${objective.state.padEnd(10)} ${objective.id}  ${objective.statement}`);
		}
	} finally {
		await pool.end();
	}
}

async function objectiveShow(id: string | undefined): Promise<void> {
	if (id === undefined) throw new Error("objective show needs an id");
	const pool = appPool();
	try {
		const objective = await getObjective(pool, id);
		if (!objective) throw new Error(`no such objective: ${id}`);
		printObjective(objective);
	} finally {
		await pool.end();
	}
}

async function objectiveAmend(
	id: string | undefined,
	flags: Map<string, string | true>,
): Promise<void> {
	if (id === undefined) throw new Error("objective amend needs an id");
	const contract = await readContract(requireString(flags, "contract"));

	const pool = appPool();
	try {
		await amendContract(pool, id, contract, "human:local");
	} finally {
		await pool.end();
	}
}

// ── The seven questions. `05-CAPABILITIES` §10, criterion 9. ─────────────────
//
// Each prints something a person can read without knowing the schema. A query
// surface whose output needs interpreting is a query surface nobody uses, and
// the criterion is that these are answered by asking rather than by reading the
// code.

const micro = (amount: number): string => `$${(amount / 1_000_000).toFixed(6)}`;

async function canCommand(worker: string | undefined): Promise<void> {
	if (!worker) throw new Error("usage: maschina can <worker>");
	const pool = appPool();
	try {
		const held = await whatCanWorkerDo(pool, worker);
		if (held.length === 0) {
			console.log(`${worker} holds nothing.`);
			return;
		}
		console.log(
			`${worker} holds ${held.length} capabilit${held.length === 1 ? "y" : "ies"}:\n`,
		);
		for (const { capability, live, available } of held) {
			const state = live ? "live" : `DEAD (${capability.status})`;
			console.log(`  ${capability.id}  ${state}`);
			console.log(
				`    ${capability.resource}: ${capability.operations.join(", ")} on ${capability.scope}`,
			);
			console.log(
				`    effect class ${capability.effectClass}, checkpoint ${capability.checkpoint}, approval ${capability.approval}`,
			);
			if (capability.limits.granted > 0) {
				console.log(
					`    budget ${micro(available)} of ${micro(capability.limits.granted)} left`,
				);
			}
			console.log("");
		}
	} finally {
		await pool.end();
	}
}

async function provenanceCommand(capabilityId: string | undefined): Promise<void> {
	if (!capabilityId) throw new Error("usage: maschina provenance <capability-id>");
	const pool = appPool();
	try {
		const chain = await provenanceOf(pool, capabilityId);
		if (chain.length === 0) {
			console.log(`No capability ${capabilityId}.`);
			return;
		}
		console.log("From this capability up to the root:\n");
		chain.forEach((capability, depth) => {
			const indent = "  ".repeat(depth);
			console.log(
				`${indent}${capability.id}  held by ${capability.holder}  [${capability.status}]`,
			);
			console.log(
				`${indent}  ${capability.resource}: ${capability.operations.join(", ")} on ${capability.scope}`,
			);
		});
		console.log(`\n${chain.length} step(s) to root.`);
	} finally {
		await pool.end();
	}
}

async function usedCommand(capabilityId: string | undefined): Promise<void> {
	if (!capabilityId) throw new Error("usage: maschina used <capability-id>");
	const pool = appPool();
	try {
		const uses = await whatWasDoneWith(pool, capabilityId);
		if (uses.length === 0) {
			console.log(`Nothing has been done with ${capabilityId}.`);
			return;
		}
		for (const use of uses) {
			const what =
				use.operation === "" ? use.type : `${use.type}  ${use.operation} ${use.target}`;
			console.log(
				`${use.at.toISOString()}  ${use.actor}  ${what}${use.result ? `  -> ${use.result}` : ""}`,
			);
		}
	} finally {
		await pool.end();
	}
}

async function deniedCommand(holder: string | undefined): Promise<void> {
	const pool = appPool();
	try {
		const denials = await whatWasDenied(pool, holder);
		if (denials.length === 0) {
			console.log(
				holder ? `Nothing has been denied to ${holder}.` : "Nothing has been denied.",
			);
			return;
		}
		for (const denial of denials) {
			console.log(`${denial.at.toISOString()}  ${denial.holder}`);
			console.log(`  ${denial.operation} ${denial.target}  REFUSED: ${denial.reason}`);
			if (denial.detail) console.log(`  ${denial.detail}`);
		}
		console.log(`\n${denials.length} denial(s).`);
	} finally {
		await pool.end();
	}
}

async function blastCommand(capabilityId: string | undefined): Promise<void> {
	if (!capabilityId) throw new Error("usage: maschina blast <capability-id>");
	const pool = appPool();
	try {
		const doomed = await whatWouldRevoking(pool, capabilityId);
		if (doomed.length === 0) {
			console.log(`No capability ${capabilityId}.`);
			return;
		}
		console.log(
			`Revoking ${capabilityId} would take ${doomed.length} capabilit${doomed.length === 1 ? "y" : "ies"}:\n`,
		);
		for (const capability of doomed) {
			console.log(
				`  ${capability.id}  ${capability.holder}  ${capability.resource}: ${capability.operations.join(", ")} on ${capability.scope}`,
			);
		}
		const holders = new Set(doomed.map((c) => c.holder));
		console.log(`\nAffecting ${holders.size} holder(s): ${[...holders].join(", ")}`);
	} finally {
		await pool.end();
	}
}

async function costCommand(objective: string | undefined): Promise<void> {
	if (!objective) throw new Error("usage: maschina cost <objective-id>");
	const pool = appPool();
	try {
		const costs = await whatDidItCost(pool, objective);
		if (costs.length === 0) {
			console.log(`${objective} has cost nothing that was metered.`);
			return;
		}
		let total = 0;
		for (const cost of costs) {
			console.log(
				`  ${cost.resource.padEnd(12)} ${micro(cost.settled).padStart(12)}  over ${cost.calls} call(s)`,
			);
			total += cost.settled;
		}
		console.log(`  ${"total".padEnd(12)} ${micro(total).padStart(12)}`);
		console.log("\nList value of what was consumed, not money billed. See ADR-009.");
	} finally {
		await pool.end();
	}
}

async function whyCommand(eventId: string | undefined): Promise<void> {
	if (!eventId) throw new Error("usage: maschina why <event-id>");
	const pool = appPool();
	try {
		const provenance = await whyDidItDecide(pool, BigInt(eventId));
		if (provenance === null) {
			console.log(`Event ${eventId} is not a recorded decision.`);
			return;
		}
		console.log(`${provenance.worker} at ${provenance.at.toISOString()}`);
		console.log(`  objective: ${provenance.objective ?? "none"}`);
		console.log(`  reasoning: ${provenance.reasoning}`);
		console.log(`  intent:    ${provenance.intentId ?? "never got that far"}`);
		console.log(
			`  outcome:   ${provenance.outcomeId ?? "none"}${provenance.result ? ` (${provenance.result})` : ""}`,
		);
		console.log(`  it saw the log up to event ${provenance.sawEventsUpTo}`);
		console.log(`\n  maschina log --objective ${provenance.objective ?? ""} --limit 50`);
		console.log("  shows exactly what it was looking at. By reference, not by copy.");
	} finally {
		await pool.end();
	}
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const command = `${argv[0] ?? ""} ${argv[1] ?? ""}`.trim();
	const flags = parseFlags(argv);

	switch (command) {
		case "db init":
			return dbInit();
		case "event append":
			return eventAppend(flags);
		case "objective state":
			return objectiveState(flags);
		case "objective list":
			return objectiveList();
		case "objective show":
			return objectiveShow(argv[2]);
		case "objective amend":
			return objectiveAmend(argv[2], flags);
		default:
			break;
	}

	// The seven questions, and `log`, all take a bare argument rather than a
	// subcommand, because they are asked far more often than anything else.
	switch (argv[0]) {
		case "log":
			return logCommand(flags);
		case "can":
			return canCommand(argv[1]);
		case "provenance":
			return provenanceCommand(argv[1]);
		case "used":
			return usedCommand(argv[1]);
		case "denied":
			return deniedCommand(argv[1]);
		case "blast":
			return blastCommand(argv[1]);
		case "cost":
			return costCommand(argv[1]);
		case "why":
			return whyCommand(argv[1]);
		default:
			break;
	}

	console.log(USAGE);
	process.exitCode = argv.length === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
