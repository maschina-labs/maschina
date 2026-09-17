import type { Check } from "./checklist.ts";
import { type CheckResult, verdict, writeResults } from "./run.ts";

/** Saves a run to results/, prints one line per check and the verdict, and returns the exit code. */
export function reportRun(
	provider: string,
	checks: readonly Check[],
	results: CheckResult[],
): number {
	const path = writeResults({ dir: "results", provider, checks, results });
	for (const result of results) {
		const expected = checks.find((c) => c.id === result.id)?.expect;
		const o = result.outcome;
		const detail =
			o.status === "allowed" ? o.signature : o.status === "refused" ? o.reason : o.message;
		process.stdout.write(
			`${result.id.padEnd(24)} expected ${expected?.padEnd(8)} got ${o.status.padEnd(8)} ${detail.slice(0, 300)}\n`,
		);
	}
	const { passed, failures } = verdict(checks, results);
	process.stdout.write(`\n${passed ? "PASSED" : "FAILED"}, saved to ${path}\n`);
	for (const failure of failures) process.stdout.write(`  ${failure.slice(0, 300)}\n`);
	return passed ? 0 : 1;
}
