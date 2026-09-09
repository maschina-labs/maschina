/**
 * Recovery.
 *
 * This decides what a worker believes after a crash it did not witness. Wrong
 * here and a resumed worker either repeats an effect that already happened or
 * abandons one that did not, and both are damaging in different directions.
 */

import type { Event } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { EFFECT_INTENDED, EFFECT_OUTCOME, WORKER_DECIDED } from "./effect.ts";
import { recover, resolutionFor } from "./recovery.ts";

let nextId = 1n;
const event = (
	type: string,
	payload: Record<string, unknown>,
	causation: bigint | null = null,
	epoch = 0n,
): Event => ({
	id: nextId++,
	recordedAt: new Date("2026-01-01T00:00:00Z"),
	actor: "worker:w1",
	objective: "obj_1",
	type,
	payload,
	epoch,
	causation,
});

const intent = (target: string, effectClass = "idempotent", epoch = 0n) =>
	event(
		EFFECT_INTENDED,
		{
			capabilityId: "cap_1",
			operation: "write",
			target,
			effectClass,
			payload: { content: "x" },
		},
		null,
		epoch,
	);

const outcome = (target: string, causation: bigint, result = "succeeded") =>
	event(
		EFFECT_OUTCOME,
		{ capabilityId: "cap_1", operation: "write", target, result },
		causation,
	);

describe("recover", () => {
	it("finds nothing in an empty log", () => {
		const state = recover([]);
		expect(state.finished).toHaveLength(0);
		expect(state.unfinished).toHaveLength(0);
		expect(state.epoch).toBe(0n);
	});

	it("reports a completed effect as finished", () => {
		const i = intent("/tmp/a.txt");
		const state = recover([i, outcome("/tmp/a.txt", i.id)]);
		expect(state.finished).toHaveLength(1);
		expect(state.unfinished).toHaveLength(0);
	});

	it("finds an Intent with no Outcome, which is the crash window", () => {
		// The one ambiguous state in the system. The effect may have happened and
		// may not have, and the log cannot say, because the process died in the gap.
		const state = recover([intent("/tmp/b.txt")]);
		expect(state.unfinished).toHaveLength(1);
		expect(state.unfinished[0]?.target).toBe("/tmp/b.txt");
	});

	it("carries the effect class forward, because that is what resolves it", () => {
		// Frozen into the Intent before the effect ran, so the question has an
		// answer written down rather than one argued about after the crash.
		const state = recover([intent("/tmp/c.txt", "unsafe")]);
		expect(state.unfinished[0]?.effectClass).toBe("unsafe");
	});

	it("matches an Outcome to its Intent by causation, not by position", () => {
		// Two effects in flight, answered out of order. Pairing by position would
		// close the wrong one and report the wrong effect as unfinished.
		const first = intent("/tmp/first.txt");
		const second = intent("/tmp/second.txt");
		const state = recover([first, second, outcome("/tmp/second.txt", second.id)]);
		expect(state.unfinished).toHaveLength(1);
		expect(state.unfinished[0]?.target).toBe("/tmp/first.txt");
	});

	it("counts a failed effect as finished, because it is not ambiguous", () => {
		// A recorded failure is a known outcome. It is the absence of an Outcome
		// that is dangerous, not a bad one.
		const i = intent("/tmp/d.txt");
		const state = recover([i, outcome("/tmp/d.txt", i.id, "failed")]);
		expect(state.unfinished).toHaveLength(0);
		expect(state.finished[0]?.result).toBe("failed");
	});

	it("counts an unknown outcome as finished too", () => {
		// `unknown` is a recorded decision to stop and escalate, not a gap. It has
		// already been handled; leaving it unfinished would handle it twice.
		const i = intent("/tmp/e.txt");
		const state = recover([i, outcome("/tmp/e.txt", i.id, "unknown")]);
		expect(state.unfinished).toHaveLength(0);
		expect(state.finished[0]?.result).toBe("unknown");
	});

	it("reports the highest epoch seen", () => {
		const state = recover([intent("/tmp/f.txt", "idempotent", 3n)]);
		expect(state.epoch).toBe(3n);
	});

	it("does not go backwards on epoch when older events follow", () => {
		// The log is ordered by id, not by epoch, and a fenced writer's events can
		// sit after a newer lease's. The generation is the highest, not the last.
		const state = recover([
			intent("/tmp/g.txt", "idempotent", 5n),
			intent("/tmp/h.txt", "idempotent", 2n),
		]);
		expect(state.epoch).toBe(5n);
	});

	it("ignores events that are not effects", () => {
		const state = recover([event(WORKER_DECIDED, { reasoning: "thinking" })]);
		expect(state.finished).toHaveLength(0);
		expect(state.unfinished).toHaveLength(0);
	});

	it("is deterministic", () => {
		// Recovery runs every time a worker restarts. A fold that drifted would
		// make the same crash resolve differently on different attempts.
		const events = [intent("/tmp/i.txt"), intent("/tmp/j.txt")];
		expect(recover(events)).toEqual(recover(events));
	});
});

describe("resolutionFor", () => {
	it("retries an idempotent effect", () => {
		// Doing it twice is the same as doing it once, so the cheapest correct
		// move is to do it again and stop wondering.
		expect(resolutionFor("idempotent")).toBe("retry");
	});

	it("reconciles a reconcilable one", () => {
		expect(resolutionFor("reconcilable")).toBe("reconcile");
	});

	it("escalates an unsafe one", () => {
		expect(resolutionFor("unsafe")).toBe("escalate");
	});

	it("escalates anything it does not recognise", () => {
		// The safe default is the expensive one. An unknown class treated as
		// idempotent would silently repeat an effect nobody said was safe to
		// repeat, and the log will grow classes this function predates.
		expect(resolutionFor("something-invented-later")).toBe("escalate");
		expect(resolutionFor("")).toBe("escalate");
	});
});
