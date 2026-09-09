/**
 * Shared plumbing for proofs.
 *
 * A proof runs against a real Postgres, because the properties being proved are
 * enforced by the database and cannot be demonstrated against a mock. That is
 * also why proofs are never cached: a cached proof reports a pass for a run that
 * did not happen.
 */

import { adminPool } from "../src/client.ts";
import { applySchema } from "../src/schema.ts";

let failures = 0;

export function check(label: string, condition: boolean, detail = ""): void {
	if (condition) {
		console.log(`  PASS  ${label}`);
	} else {
		failures++;
		console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
	}
}

export function failureCount(): number {
	return failures;
}

export function verdict(name: string): void {
	console.log(failures === 0 ? `\n${name}: PASS\n` : `\n${name}: FAIL (${failures})\n`);
	process.exitCode = failures === 0 ? 0 : 1;
}

/**
 * Reset the log so a proof is repeatable without manual steps.
 *
 * The log is append-only, so this cannot DELETE. It drops and recreates, using
 * the admin role. Guarded to localhost: a harness that can destroy an event log
 * is only acceptable when it demonstrably cannot reach a real one.
 */
export async function resetLog(): Promise<void> {
	const url = process.env.MASCHINA_ADMIN_URL ?? "postgres://localhost";
	const host = new URL(url).hostname;
	if (host !== "localhost" && host !== "127.0.0.1") {
		throw new Error(
			`Refusing to reset a non-local database (host: ${host}). ` +
				"This drops the events table and must never run against a real log.",
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
