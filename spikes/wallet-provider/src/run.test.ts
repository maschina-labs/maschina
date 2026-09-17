import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { Check } from "./checklist.ts";
import { type Outcome, runChecks, verdict, writeResults } from "./run.ts";

const checks: Check[] = [
	{ id: "to-owner", describe: "", expect: "allowed", network: "devnet" },
	{ id: "to-stranger", describe: "", expect: "refused", pairedWith: "to-owner", network: "devnet" },
];

const attemptWith =
	(outcomes: Record<string, Outcome>) =>
	async (check: Check): Promise<Outcome> => {
		const outcome = outcomes[check.id];
		if (!outcome) throw new Error(`no outcome for ${check.id}`);
		return outcome;
	};

const allowed = (signature = "sig"): Outcome => ({ status: "allowed", signature });
const refused = (reason = "policy denied"): Outcome => ({ status: "refused", reason });

describe("verdict", () => {
	it("passes when every check behaves as expected", async () => {
		const results = await runChecks(
			checks,
			attemptWith({ "to-owner": allowed(), "to-stranger": refused() }),
		);
		assert.deepEqual(verdict(checks, results), { passed: true, failures: [] });
	});

	it("fails a refusal whose allowed pair also failed, because the setup may be what's broken", async () => {
		const results = await runChecks(
			checks,
			attemptWith({ "to-owner": refused(), "to-stranger": refused() }),
		);
		const { passed, failures } = verdict(checks, results);
		assert.equal(passed, false);
		assert.ok(failures.some((f) => f.startsWith("to-owner:")));
		assert.ok(failures.some((f) => f.startsWith("to-stranger:") && f.includes("to-owner")));
	});

	it("never counts an error as a refusal", async () => {
		const results = await runChecks(
			checks,
			attemptWith({
				"to-owner": allowed(),
				"to-stranger": { status: "error", message: "timeout" },
			}),
		);
		const { passed, failures } = verdict(checks, results);
		assert.equal(passed, false);
		assert.ok(failures.some((f) => f.startsWith("to-stranger:") && f.includes("timeout")));
	});

	it("fails a forbidden action that went through", async () => {
		const results = await runChecks(
			checks,
			attemptWith({ "to-owner": allowed(), "to-stranger": allowed("bad") }),
		);
		assert.equal(verdict(checks, results).passed, false);
	});

	it("fails when a check never ran", async () => {
		const results = await runChecks(checks.slice(0, 1), attemptWith({ "to-owner": allowed() }));
		const { passed, failures } = verdict(checks, results);
		assert.equal(passed, false);
		assert.ok(failures.some((f) => f.startsWith("to-stranger:") && f.includes("did not run")));
	});
});

describe("runChecks", () => {
	it("records an attempt that throws as an error instead of stopping", async () => {
		const results = await runChecks(checks, async (check) => {
			if (check.id === "to-owner") throw new Error("network down");
			return refused();
		});
		assert.deepEqual(
			results.map((r) => [r.id, r.outcome.status]),
			[
				["to-owner", "error"],
				["to-stranger", "refused"],
			],
		);
		assert.match(
			results[0]?.outcome.status === "error" ? results[0].outcome.message : "",
			/network down/,
		);
	});

	it("times each attempt", async () => {
		let now = 1_000;
		const results = await runChecks(
			checks,
			async () => {
				now += 250;
				return allowed();
			},
			() => now,
		);
		assert.deepEqual(
			results.map((r) => r.ms),
			[250, 250],
		);
	});
});

describe("writeResults", () => {
	const dir = mkdtempSync(join(tmpdir(), "wallet-spike-"));
	after(() => rmSync(dir, { recursive: true, force: true }));

	it("saves results with the provider, time and verdict", async () => {
		const results = await runChecks(
			checks,
			attemptWith({ "to-owner": allowed("abc"), "to-stranger": refused() }),
		);
		const path = writeResults({
			dir,
			provider: "turnkey",
			checks,
			results,
			at: new Date("2026-09-16T12:00:00.000Z"),
		});
		assert.equal(path, join(dir, "turnkey-2026-09-16T12-00-00-000Z.json"));
		const saved = JSON.parse(readFileSync(path, "utf8"));
		assert.equal(saved.provider, "turnkey");
		assert.equal(saved.passed, true);
		assert.equal(saved.results[0].outcome.signature, "abc");
	});
});
