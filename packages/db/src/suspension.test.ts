/**
 * Suspension.
 *
 * Two reasons a worker stops, and one of them is resolved by a clock while the
 * other never is. Confusing them means either waking a person to watch a clock,
 * or waiting forever for a question nobody was asked.
 */

import { describe, expect, it } from "vitest";
import { foldSuspension, isDue, WORKER_RESUMED, WORKER_SUSPENDED } from "./suspension.ts";

type LogEvent = { type: string; payload: Record<string, unknown>; recordedAt: Date };

const T0 = new Date("2026-01-01T00:00:00.000Z");
const at = (iso: string) => new Date(iso);

const untilEvent = (resumeAt: string, recordedAt = T0): LogEvent => ({
	type: WORKER_SUSPENDED,
	recordedAt,
	payload: { v: 1, worker: "worker:w1", kind: "until", reason: "quota", resumeAt },
});

const askingEvent = (recordedAt = T0): LogEvent => ({
	type: WORKER_SUSPENDED,
	recordedAt,
	payload: {
		v: 1,
		worker: "worker:w1",
		kind: "question",
		reason: "no authority",
		question: "which capabilities should this worker hold?",
	},
});

const resumedEvent = (recordedAt = T0): LogEvent => ({
	type: WORKER_RESUMED,
	recordedAt,
	payload: { v: 1, worker: "worker:w1", because: "the limit lifted" },
});

describe("foldSuspension", () => {
	it("is null when nothing has stopped", () => {
		expect(foldSuspension([])).toBeNull();
	});

	it("reads a suspension waiting on a time", () => {
		const s = foldSuspension([untilEvent("2026-01-01T02:30:00.000Z")]);
		expect(s?.kind).toBe("until");
		expect(s?.resumeAt).toEqual(at("2026-01-01T02:30:00.000Z"));
		expect(s?.question).toBeNull();
	});

	it("reads a suspension waiting on a person", () => {
		const s = foldSuspension([askingEvent()]);
		expect(s?.kind).toBe("question");
		expect(s?.question).toContain("which capabilities");
		expect(s?.resumeAt).toBeNull();
	});

	it("is null again once resumed", () => {
		expect(foldSuspension([untilEvent("2026-01-01T02:30:00.000Z"), resumedEvent()])).toBeNull();
	});

	it("takes the most recent suspension", () => {
		const s = foldSuspension([
			untilEvent("2026-01-01T02:30:00.000Z"),
			resumedEvent(),
			askingEvent(),
		]);
		expect(s?.kind).toBe("question");
	});

	it("treats an unrecognised kind as a question", () => {
		// The safe default is the one that waits for a person. Guessing "until"
		// for something unreadable would resume on a clock that means nothing.
		const s = foldSuspension([
			{ type: WORKER_SUSPENDED, recordedAt: T0, payload: { v: 1, kind: "invented-later" } },
		]);
		expect(s?.kind).toBe("question");
	});
});

describe("isDue", () => {
	const until = (resumeAt: string) => {
		const s = foldSuspension([untilEvent(resumeAt)]);
		if (s === null) throw new Error("expected a suspension");
		return s;
	};

	it("is not due before the time", () => {
		expect(isDue(until("2026-01-01T02:30:00.000Z"), at("2026-01-01T02:29:59.999Z"))).toBe(
			false,
		);
	});

	it("is due at the time, and after it", () => {
		expect(isDue(until("2026-01-01T02:30:00.000Z"), at("2026-01-01T02:30:00.000Z"))).toBe(true);
		expect(isDue(until("2026-01-01T02:30:00.000Z"), at("2026-01-01T09:00:00.000Z"))).toBe(true);
	});

	it("is never due when a person is being asked", () => {
		// The rule this file exists for. A question does not answer itself given
		// enough time, and treating it as due would resume a worker into the same
		// wall it stopped at.
		const asking = foldSuspension([askingEvent()]);
		if (asking === null) throw new Error("expected a suspension");
		expect(isDue(asking, at("2099-01-01T00:00:00.000Z"))).toBe(false);
	});

	it("is never due without a time, whatever the kind says", () => {
		const s = foldSuspension([
			{ type: WORKER_SUSPENDED, recordedAt: T0, payload: { v: 1, kind: "until" } },
		]);
		if (s === null) throw new Error("expected a suspension");
		expect(isDue(s, at("2099-01-01T00:00:00.000Z"))).toBe(false);
	});
});
