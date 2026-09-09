/**
 * Slice 0 proof. STAGE_0_PLAN, slice 0:
 *
 *   "Append three events from the CLI. Read them back in order. Confirm by
 *    inspection that there is no update or delete path in the code."
 *
 * Run: npm run proof   (after `npm run db:reset`)
 *
 * The plan says to confirm the third point by inspection. This does it
 * mechanically as well, because 01-PRINCIPLES P4 prefers evidence to reading,
 * and because an inspection that has to be repeated every session will stop
 * being repeated.
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { adminPool, appPool } from "../src/client.ts";
import { append, head, read } from "../src/log.ts";
import { applySchema } from "../src/schema.ts";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
	if (condition) {
		console.log(`  PASS  ${label}`);
	} else {
		failures++;
		console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
	}
}

/** Run one statement as one role and return the error message, or null. */
async function expectRejected(
	user: string,
	password: string,
	sql: string,
): Promise<string | null> {
	const client = new Client({
		host: "localhost",
		port: 5432,
		database: "maschina",
		user,
		password,
	});
	await client.connect();
	try {
		await client.query(sql);
		return null;
	} catch (error: unknown) {
		return error instanceof Error ? error.message : String(error);
	} finally {
		await client.end();
	}
}

/**
 * Reset the log so the proof is repeatable without manual steps.
 *
 * The log is append-only, so this cannot DELETE. It drops and recreates, using
 * the admin role. Guarded to localhost: a harness that can destroy an event log
 * is only acceptable when it demonstrably cannot reach a real one.
 */
async function resetLog(): Promise<void> {
	const url = process.env["MASCHINA_ADMIN_URL"] ?? "postgres://localhost";
	const host = new URL(url).hostname;
	if (host !== "localhost" && host !== "127.0.0.1") {
		throw new Error(
			`Refusing to reset a non-local database (host: ${host}). ` +
				"This proof drops the events table and must never run against a real log.",
		);
	}

	const admin = adminPool();
	try {
		await admin.query("DROP TABLE IF EXISTS events CASCADE");
		await applySchema(admin);
	} finally {
		await admin.end();
	}
}

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nSlice 0: the log\n");

	// ── 1. The log starts empty ────────────────────────────────────────────────
	console.log("1. A fresh log is empty");
	const before = await read(pool);
	check("log is empty", before.length === 0, `found ${before.length} events`);

	// ── 2. Append three events ─────────────────────────────────────────────────
	console.log("\n2. Append three events");
	const first = await append(pool, {
		actor: "human:ash",
		type: "objective.stated",
		payload: { statement: "Prove the log exists" },
	});
	const second = await append(pool, {
		actor: "human:ash",
		type: "note.recorded",
		payload: { text: "second" },
	});
	const third = await append(pool, {
		actor: "worker:proof",
		type: "note.recorded",
		objective: "obj-1",
		causation: second.id,
		payload: { text: "third" },
	});
	check(
		"three ids assigned by the log",
		first.id === 1n && second.id === 2n && third.id === 3n,
	);
	check("caller never supplied an id", third.causation === second.id);

	// ── 3. Read them back in order ─────────────────────────────────────────────
	console.log("\n3. Read them back in order");
	const events = await read(pool);
	check("three events returned", events.length === 3, `got ${events.length}`);
	check(
		"ascending by id",
		events.every((event, index) => event.id === BigInt(index + 1)),
	);
	check(
		"payload survived the round trip",
		events[0]?.payload.statement === "Prove the log exists",
	);
	check("causation preserved", events[2]?.causation === 2n);
	check("objective filter works", (await read(pool, { objective: "obj-1" })).length === 1);
	check("actor filter works", (await read(pool, { actor: "human:ash" })).length === 2);
	check("after cursor works", (await read(pool, { after: 1n })).length === 2);
	check("head is 3", (await head(pool)) === 3n);

	await pool.end();

	// ── 4. Append-only, layer 1: the app role holds no destructive grant ───────
	console.log("\n4. Append-only, layer 1: grants (role: maschina_app)");
	for (const [label, sql] of [
		["UPDATE rejected", "UPDATE events SET actor = 'forged' WHERE id = 1"],
		["DELETE rejected", "DELETE FROM events WHERE id = 1"],
		["TRUNCATE rejected", "TRUNCATE events"],
		[
			"id forgery rejected",
			"INSERT INTO events (id, actor, type) OVERRIDING SYSTEM VALUE VALUES (999, 'a', 'forged')",
		],
		[
			"backdating rejected",
			"INSERT INTO events (recorded_at, actor, type) VALUES ('1999-01-01', 'a', 'backdated')",
		],
	] as const) {
		const error = await expectRejected("maschina_app", "maschina_app", sql);
		check(label, error !== null, "statement succeeded");
	}

	// ── 5. Append-only, layer 2: triggers stop the owner too ───────────────────
	console.log("\n5. Append-only, layer 2: triggers (role: maschina, owner)");
	for (const [label, sql] of [
		["UPDATE rejected", "UPDATE events SET actor = 'forged' WHERE id = 1"],
		["DELETE rejected", "DELETE FROM events WHERE id = 1"],
		["TRUNCATE rejected", "TRUNCATE events"],
	] as const) {
		const error = await expectRejected("maschina", "maschina", sql);
		check(
			label,
			error !== null && error.includes("append-only"),
			error === null ? "statement succeeded" : error,
		);
	}

	// ── 6. No update or delete path in the code ────────────────────────────────
	console.log("\n6. No mutation path exists in src/");
	const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
	const offenders: string[] = [];

	/**
	 * Strip comments only. String literals are deliberately KEPT: SQL reaches the
	 * database as a string, so stripping strings would delete exactly what this
	 * check is looking for. An earlier version of this stripped quoted strings
	 * and consequently passed while a real `DELETE FROM events` sat in log.ts.
	 *
	 * Prose is instead excluded by requiring a table name in each pattern, so the
	 * `console.log` that explains "UPDATE, DELETE and TRUNCATE raise" does not
	 * match while an actual statement does.
	 */
	function executableSource(source: string): string {
		return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
	}

	async function walk(dir: string): Promise<void> {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const path = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				await walk(path);
			} else if (entry.name.endsWith(".ts")) {
				const source = executableSource(await readFile(path, "utf8"));
				// SQL verbs, not English words: a mutation has to be written as a
				// statement to reach the database.
				for (const pattern of [
					/\bUPDATE\s+events\b/i,
					/\bDELETE\s+FROM\s+events\b/i,
					/\bTRUNCATE\s+(?:TABLE\s+)?events\b/i,
				]) {
					if (pattern.test(source)) offenders.push(`${entry.name}: /${pattern.source}/`);
				}
			}
		}
	}
	await walk(srcRoot);
	check(
		"no UPDATE / DELETE / TRUNCATE in src/**/*.ts",
		offenders.length === 0,
		offenders.join(", "),
	);

	// ── Verdict ────────────────────────────────────────────────────────────────
	console.log(
		failures === 0 ? "\nSlice 0 proof: PASS\n" : `\nSlice 0 proof: FAIL (${failures})\n`,
	);
	process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
