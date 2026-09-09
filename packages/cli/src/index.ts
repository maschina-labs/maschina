/**
 * The Maschina CLI. 08-ENVIRONMENT §5: the CLI is not a lesser surface, it is a
 * forcing function. Anything it can do exists in the control plane, so a later
 * graphical surface cannot discover that half the capability lives in a UI.
 *
 * Slice 0 scope: append an event, print the stream, initialise the schema.
 *
 * Argument parsing is done by hand. A CLI framework is not paid for by a named
 * problem yet (01-PRINCIPLES P12) and three commands do not need one.
 */

import type { NewEvent } from "@maschina/core";
import { adminPool, append, applySchema, appPool, head, read } from "@maschina/db";

const USAGE = `maschina, Stage 0

  db init                  create the events table and the app role
  event append             append one event to the log
    --actor <s>            required. which worker, node, or human
    --type <s>             required. what kind of fact this records
    --objective <s>        what this was in service of
    --payload <json>       defaults to {}
    --causation <id>       the event that caused this one
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

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const command = `${argv[0] ?? ""} ${argv[1] ?? ""}`.trim();
	const flags = parseFlags(argv);

	switch (command) {
		case "db init":
			return dbInit();
		case "event append":
			return eventAppend(flags);
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
