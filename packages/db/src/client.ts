/**
 * Postgres connection. 03-RUNTIME §9 chose Postgres for the log and lease store
 * through Stage 2, and ADR-001 keeps it the only thing in docker-compose.
 */

import { Pool, types } from "pg";

// node-postgres returns BIGINT (oid 20) as a string to avoid silent precision
// loss in JS numbers. Event ids and epochs are bigints in the domain model, so
// parse them as bigint rather than carrying strings around and converting at
// every call site.
types.setTypeParser(20, (value: string) => BigInt(value));

// Local development defaults. These match docker/docker-compose.yml and are
// deliberately boring. They are not credentials worth protecting, and ADR-002
// covers why secret custody is not solved yet. Anything real comes from the
// environment and overrides these.
const DEFAULTS = {
	MASCHINA_ADMIN_URL: "postgres://maschina:maschina@localhost:5432/maschina",
	MASCHINA_DATABASE_URL: "postgres://maschina_app:maschina_app@localhost:5432/maschina",
} as const;

/**
 * Where to connect, from one place.
 *
 * Exported because the event listener needs its own connection rather than a
 * pooled one, and a listener pointed at a different database than the queries is
 * a bug nobody would find quickly.
 */
export function connectionString(role: "app" | "admin"): string {
	const key = role === "admin" ? "MASCHINA_ADMIN_URL" : "MASCHINA_DATABASE_URL";
	return process.env[key] ?? DEFAULTS[key];
}

/**
 * The pool everything normal uses. Connects as `maschina_app`, which holds
 * INSERT and SELECT on events and nothing else, so an accidental UPDATE or
 * DELETE fails at the database rather than succeeding quietly.
 */
export function appPool(): Pool {
	return new Pool({ connectionString: connectionString("app") });
}

/**
 * The schema owner. Used only by `maschina db init`. Kept as a separate
 * function so that reaching for it is a visible act rather than a default.
 */
export function adminPool(): Pool {
	return new Pool({ connectionString: connectionString("admin") });
}
