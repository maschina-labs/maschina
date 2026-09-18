import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EffectClass } from "./effect.ts";
import type { FailureClass } from "./failure.ts";
import {
	judgeHealth,
	planRecovery,
	REPEATED_FAILURE_LIMIT,
	reconcile,
	type UnfinishedRun,
} from "./recovery.ts";

const run = (overrides: Partial<UnfinishedRun> = {}): UnfinishedRun => ({
	runId: "0199a0a0-0000-7000-8000-000000000010",
	machineId: "0199a0a0-0000-7000-8000-000000000001",
	tradeId: "0199a0a0-0000-7000-8000-000000000099",
	effect: "reconcilable",
	attempt: 1,
	...overrides,
});

describe("planRecovery", () => {
	it("repeats an action that is safe to repeat", () => {
		expect(planRecovery(run({ effect: "idempotent" }))).toMatchObject({ do: "repeat" });
	});

	it("asks the chain about a transaction, using its signature when there is one", () => {
		const plan = planRecovery(run({ signature: "5".repeat(88) }));
		expect(plan).toMatchObject({ do: "ask_the_world", signature: "5".repeat(88) });
	});

	it("still asks the chain when no signature was recorded, rather than assuming nothing happened", () => {
		const plan = planRecovery(run());
		expect(plan.do).toBe("ask_the_world");
		expect(plan.do === "ask_the_world" && plan.because).toMatch(/recent history/);
	});

	it("asks a person about an action that can be neither repeated nor checked", () => {
		expect(planRecovery(run({ effect: "unsafe" }))).toMatchObject({ do: "ask_a_person" });
	});

	it("never repeats a Solana transaction, whatever the attempt", () => {
		for (const attempt of [1, 2, 9]) {
			expect(planRecovery(run({ attempt })).do).not.toBe("repeat");
		}
	});
});

describe("reconcile", () => {
	it("settles a trade the chain says happened", () => {
		expect(reconcile({ happened: true, signature: "abc" })).toEqual({
			settle: "completed",
			signature: "abc",
		});
	});

	it("lets a trade that never happened be tried again", () => {
		expect(reconcile({ happened: false })).toEqual({ settle: "not_done", retry: true });
	});

	it("writes nothing and retries nothing while it is still unclear", () => {
		expect(reconcile({ unclear: true })).toEqual({ settle: "still_unknown" });
	});
});

describe("judgeHealth", () => {
	const failure = (kind: FailureClass, reason = "rpc timeout") => ({ failure: kind, reason });

	it("leaves a machine alone when nothing has failed", () => {
		expect(judgeHealth({ recent: [] })).toEqual({ pause: false });
	});

	it("leaves a machine alone after one or two failures", () => {
		expect(judgeHealth({ recent: [failure("transient")] })).toEqual({ pause: false });
		expect(judgeHealth({ recent: [failure("transient"), failure("transient")] })).toEqual({
			pause: false,
		});
	});

	it("pauses after three of the same failure in a row, saying what kept happening", () => {
		const judgement = judgeHealth({
			recent: [
				failure("transient", "rpc timeout"),
				failure("transient", "rpc timeout"),
				failure("transient", "rpc timeout"),
			],
		});
		expect(judgement).toMatchObject({ pause: true, failure: "transient", times: 3 });
		expect(judgement.pause && judgement.reason).toMatch(/3 runs in a row/);
	});

	it("doesn't pause for three different failures, which is bad luck rather than a pattern", () => {
		expect(
			judgeHealth({
				recent: [failure("transient"), failure("permanent"), failure("transient")],
			}),
		).toEqual({ pause: false });
	});

	it("counts only the run of failures at the top, so a success in between clears it", () => {
		// The record gives the most recent first; an older streak below a different failure doesn't count.
		expect(
			judgeHealth({
				recent: [
					failure("budget"),
					failure("transient"),
					failure("transient"),
					failure("transient"),
				],
			}),
		).toEqual({ pause: false });
	});

	it("uses the same limit for every kind of failure", () => {
		const classes: FailureClass[] = [
			"transient",
			"permanent",
			"ambiguous",
			"authority",
			"budget",
			"waiting",
			"unknown",
		];
		for (const kind of classes) {
			const judgement = judgeHealth({ recent: Array(3).fill(failure(kind)) });
			expect(judgement.pause, kind).toBe(true);
		}
	});
});

describe("recovery, for any run and any history", () => {
	const anyEffect = fc.constantFrom<EffectClass>("idempotent", "reconcilable", "unsafe");
	const anyFailure = fc.constantFrom<FailureClass>(
		"transient",
		"permanent",
		"ambiguous",
		"authority",
		"budget",
		"waiting",
		"unknown",
	);

	it("never plans to repeat anything that isn't idempotent", () => {
		fc.assert(
			fc.property(anyEffect, fc.integer({ min: 1, max: 20 }), (effect, attempt) => {
				const plan = planRecovery(run({ effect, attempt }));
				if (plan.do === "repeat") expect(effect).toBe("idempotent");
			}),
			{ numRuns: 500 },
		);
	});

	it("pauses exactly when the newest failures are the same, three or more deep", () => {
		fc.assert(
			fc.property(fc.array(anyFailure, { maxLength: 12 }), (classes) => {
				const recent = classes.map((kind) => ({ failure: kind, reason: "because" }));
				const judgement = judgeHealth({ recent });
				const first = recent[0]?.failure;
				let sameInARow = 0;
				for (const entry of recent) {
					if (entry.failure !== first) break;
					sameInARow += 1;
				}
				expect(judgement.pause).toBe(sameInARow >= REPEATED_FAILURE_LIMIT);
			}),
			{ numRuns: 1000 },
		);
	});
});
