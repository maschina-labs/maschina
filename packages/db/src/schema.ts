/**
 * The schema is owned by this package, not by whoever applies it.
 *
 * The CLI used to read `schema.sql` by walking a relative path into another
 * directory. That works until the directory moves, which it just did. A package
 * that owns a schema should expose applying it, not expose where the file lives.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

/** The schema DDL, as text. */
export async function readSchema(): Promise<string> {
	return readFile(SCHEMA_PATH, "utf8");
}

/**
 * Create the events table, the append-only triggers, and the application role.
 *
 * Idempotent: safe to run against an already-initialised database. Must be run
 * with the admin pool. The application role deliberately cannot create tables.
 */
export async function applySchema(pool: Pool): Promise<void> {
	await pool.query(await readSchema());
}
