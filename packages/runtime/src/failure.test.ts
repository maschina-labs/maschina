import { describe, expect, it } from "vitest";
import { type FailureClass, isRetryable, MAX_TRANSIENT_ATTEMPTS, respondTo } from "./failure.ts";

describe("respondTo", () => {
	it("retries a transient failure a few times, then pauses", () => {
		expect(respondTo({ class: "transient" }, 1)).toEqual({ action: "retry" });
		expect(respondTo({ class: "transient" }, MAX_TRANSIENT_ATTEMPTS)).toEqual({
			action: "pause",
			notify: true,
		});
	});

	it("skips a permanent failure", () => {
		expect(respondTo({ class: "permanent" }, 1)).toEqual({ action: "skip" });
	});

	it("reconciles an ambiguous one instead of guessing", () => {
		expect(respondTo({ class: "ambiguous" }, 1)).toEqual({ action: "reconcile" });
	});

	it.each(["authority", "budget"] as const)("pauses and tells the owner on %s", (kind) => {
		expect(respondTo({ class: kind }, 1)).toEqual({ action: "pause", notify: true });
	});

	it("waits until a known time without bothering anyone", () => {
		const at = new Date("2026-09-16T18:00:00.000Z");
		expect(respondTo({ class: "waiting", resumesAt: at }, 1)).toEqual({ action: "resume_at", at });
	});

	it("asks when the wait has no known end", () => {
		expect(respondTo({ class: "waiting" }, 1)).toEqual({ action: "pause", notify: true });
	});
});

describe("isRetryable", () => {
	it("only retries transient failures", () => {
		const classes: FailureClass[] = [
			"transient",
			"permanent",
			"ambiguous",
			"authority",
			"budget",
			"waiting",
		];
		expect(classes.filter((c) => isRetryable({ class: c }))).toEqual(["transient"]);
	});
});
