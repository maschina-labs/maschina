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
	read,
	stateObjective,
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

	// `log` takes no subcommand.
	if (argv[0] === "log") return logCommand(flags);

	console.log(USAGE);
	process.exitCode = argv.length === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
