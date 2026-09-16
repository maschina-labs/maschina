import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./checklist.ts";

/**
 * What happened when a check was attempted. An error is never a refusal: a refusal is the provider
 * saying no because of the policy, while an error means the attempt didn't get that far.
 */
export type Outcome =
	| { status: "allowed"; signature: string }
	| { status: "refused"; reason: string }
	| { status: "error"; message: string };

export type Attempt = (check: Check) => Promise<Outcome>;

export type CheckResult = { id: string; outcome: Outcome; ms: number };

export async function runChecks(
	checks: readonly Check[],
	attempt: Attempt,
	now: () => number = performance.now.bind(performance),
): Promise<CheckResult[]> {
	const results: CheckResult[] = [];
	for (const check of checks) {
		const started = now();
		let outcome: Outcome;
		try {
			outcome = await attempt(check);
		} catch (error) {
			outcome = {
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		}
		results.push({ id: check.id, outcome, ms: now() - started });
	}
	return results;
}

export function verdict(
	checks: readonly Check[],
	results: readonly CheckResult[],
): { passed: boolean; failures: string[] } {
	const byId = new Map(results.map((result) => [result.id, result]));
	const behaved = (check: Check) => byId.get(check.id)?.outcome.status === check.expect;
	const failures: string[] = [];

	for (const check of checks) {
		const result = byId.get(check.id);
		if (!result) {
			failures.push(`${check.id}: did not run`);
			continue;
		}
		const { outcome } = result;
		if (outcome.status === "error") {
			failures.push(`${check.id}: errored before the provider decided (${outcome.message})`);
		} else if (outcome.status !== check.expect) {
			failures.push(`${check.id}: expected ${check.expect}, was ${outcome.status}`);
		} else if (check.expect === "refused") {
			const pair = checks.find((c) => c.id === check.pairedWith);
			if (!pair || !behaved(pair)) {
				failures.push(
					`${check.id}: refused, but its allowed pair ${check.pairedWith} failed, so the refusal proves nothing`,
				);
			}
		}
	}
	return { passed: failures.length === 0, failures };
}

/** Saves a run as JSON, named by provider and time, and returns its path. */
export function writeResults(options: {
	dir: string;
	provider: string;
	checks: readonly Check[];
	results: readonly CheckResult[];
	at?: Date;
}): string {
	const at = options.at ?? new Date();
	const { passed, failures } = verdict(options.checks, options.results);
	mkdirSync(options.dir, { recursive: true });
	const path = join(
		options.dir,
		`${options.provider}-${at.toISOString().replaceAll(/[:.]/g, "-")}.json`,
	);
	const report = {
		provider: options.provider,
		at: at.toISOString(),
		passed,
		failures,
		results: options.results,
	};
	writeFileSync(path, `${JSON.stringify(report, null, "\t")}\n`);
	return path;
}
