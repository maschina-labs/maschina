/**
 * The objective projection.
 *
 * An objective has no row anywhere. Its entire existence is these events folded
 * in order, so if `fold` is wrong the objective is wrong, and nothing else in
 * the system would notice. That makes this the most load-bearing pure function
 * written so far.
 */

import type { Contract } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { PAYLOAD_V } from "./log.ts";
import {
	fold,
	OBJECTIVE_ADMITTED,
	OBJECTIVE_AMENDMENT_REFUSED,
	OBJECTIVE_EVALUATED,
	OBJECTIVE_REJECTED,
	OBJECTIVE_STATED,
} from "./objective.ts";

const CONTRACT: Contract = {
	criteria: [
		{
			id: "c1",
			criterion: "it works",
			verifyBy: "the proof passes",
			strength: "mechanical",
			evidence: ["proof output"],
		},
	],
	nonGoals: ["anything else"],
	failureConditions: ["the machine is on fire"],
};

type LogEvent = { type: string; actor: string; payload: Record<string, unknown> };

const statedEvent = (overrides: Partial<Record<string, unknown>> = {}): LogEvent => ({
	type: OBJECTIVE_STATED,
	actor: "human:ash",
	payload: {
		statement: "Do the thing",
		contract: CONTRACT,
		constraints: { maxSteps: 20 },
		parent: null,
		...overrides,
	},
});

const admittedEvent = (hash = "abc123"): LogEvent => ({
	type: OBJECTIVE_ADMITTED,
	actor: "human:ash",
	payload: { contractHash: hash },
});

describe("fold", () => {
	it("returns null when nothing was ever stated", () => {
		expect(fold([])).toBeNull();
	});

	it("returns null for events that do not include a statement", () => {
		// An admitted event with no preceding stated event is not half an
		// objective, it is not an objective.
		expect(fold([admittedEvent()])).toBeNull();
	});

	it("builds a stated objective from one event", () => {
		const objective = fold([statedEvent()]);
		expect(objective).not.toBeNull();
		expect(objective?.state).toBe("stated");
		expect(objective?.statement).toBe("Do the thing");
		expect(objective?.origin).toBe("human:ash");
		expect(objective?.constraints).toEqual({ maxSteps: 20 });
		expect(objective?.parent).toBeNull();
	});

	it("has no contract hash until admitted", () => {
		// The hash is the freeze. Before admission there is nothing frozen, and
		// reporting one would imply a guarantee that does not exist yet.
		expect(fold([statedEvent()])?.contractHash).toBeNull();
	});

	it("freezes the contract hash on admission", () => {
		const objective = fold([statedEvent(), admittedEvent("deadbeef")]);
		expect(objective?.state).toBe("admitted");
		expect(objective?.contractHash).toBe("deadbeef");
	});

	it("records why admission was refused", () => {
		const objective = fold([
			statedEvent(),
			{
				type: OBJECTIVE_REJECTED,
				actor: "human:ash",
				payload: { problems: ["no criteria", "no evidence"] },
			},
		]);
		expect(objective?.state).toBe("rejected");
		expect(objective?.rejectedReason).toBe("no criteria; no evidence");
		expect(objective?.contractHash).toBeNull();
	});

	it("leaves an admitted objective completely unchanged by a refused amendment", () => {
		// This is the whole anti-Goodhart control. If a refusal could move the
		// hash, the freeze would be theatre.
		const before = fold([statedEvent(), admittedEvent("frozen")]);
		const after = fold([
			statedEvent(),
			admittedEvent("frozen"),
			{
				type: OBJECTIVE_AMENDMENT_REFUSED,
				actor: "worker:eager",
				payload: {
					reason: "the contract was frozen at admission and cannot change",
					frozenHash: "frozen",
					attemptedHash: "something-more-convenient",
				},
			},
		]);
		expect(after).toEqual(before);
		expect(after?.contractHash).toBe("frozen");
	});

	it("ignores event types it does not know about", () => {
		// The log is append-only and will grow event types this function predates.
		// An unknown event must not corrupt the fold or throw.
		const objective = fold([
			statedEvent(),
			admittedEvent("frozen"),
			{ type: "something.invented.later", actor: "worker:1", payload: { anything: true } },
		]);
		expect(objective?.state).toBe("admitted");
		expect(objective?.contractHash).toBe("frozen");
	});

	it("is deterministic: folding twice gives the same answer", () => {
		// Projections are rebuilt, constantly. A fold that drifted between runs
		// would make the log an unreliable source of truth.
		const events = [statedEvent(), admittedEvent("frozen")];
		expect(fold(events)).toEqual(fold(events));
	});

	it("takes the last state when a lifecycle event repeats", () => {
		// Ordering is the log's, and later events win. Re-admission with a
		// different hash should not silently keep the older one.
		const objective = fold([statedEvent(), admittedEvent("first"), admittedEvent("second")]);
		expect(objective?.contractHash).toBe("second");
	});

	it("defaults constraints and parent when the payload omits them", () => {
		const objective = fold([
			{
				type: OBJECTIVE_STATED,
				actor: "human:ash",
				payload: { statement: "Sparse", contract: CONTRACT },
			},
		]);
		expect(objective?.constraints).toEqual({});
		expect(objective?.parent).toBeNull();
	});

	it("reads an unversioned event as version 1", () => {
		// ADR-006 R4. Slice 0 and slice 1 wrote events before versioning existed.
		// Those events are in the log forever and absence means 1, not corruption.
		const objective = fold([statedEvent(), admittedEvent("frozen")]);
		expect(objective?.state).toBe("admitted");
		expect(objective?.contractHash).toBe("frozen");
	});

	it("reads a current-version event", () => {
		const objective = fold([
			{
				type: OBJECTIVE_STATED,
				actor: "human:ash",
				payload: { v: PAYLOAD_V, statement: "Versioned", contract: CONTRACT },
			},
		]);
		expect(objective?.statement).toBe("Versioned");
	});

	it("refuses a payload version from the future rather than guessing", () => {
		// 01-PRINCIPLES P8: ambiguity blocks. A reader that meets a shape it does
		// not understand must stop, not silently fold a partial objective.
		expect(() =>
			fold([
				{
					type: OBJECTIVE_STATED,
					actor: "human:ash",
					payload: { v: PAYLOAD_V + 1, statement: "From the future", contract: CONTRACT },
				},
			]),
		).toThrow(/newer than this reader understands/);
	});

	it("carries the contract through untouched", () => {
		expect(fold([statedEvent()])?.contract).toEqual(CONTRACT);
	});
});

describe("fold, on evaluation", () => {
	const evaluated = (outcome: string, rollupResult = outcome): LogEvent => ({
		type: OBJECTIVE_EVALUATED,
		actor: "worker:judge",
		payload: {
			v: PAYLOAD_V,
			objective: "obj_1",
			evaluator: "worker:judge",
			contractHash: "frozen",
			verdicts: [],
			rollup: rollupResult,
			outcome,
			remaining: [],
		},
	});

	it("accomplishes an objective whose verdict says so", () => {
		const objective = fold([statedEvent(), admittedEvent("frozen"), evaluated("accomplished")]);
		expect(objective?.state).toBe("accomplished");
	});

	it("suspends rather than deciding when the verdict is indeterminate", () => {
		// The rule that must not soften. "We cannot tell" is blocking, and any
		// rounding here puts a false completion, or a discarded success, into a
		// record that is never edited.
		const objective = fold([
			statedEvent(),
			admittedEvent("frozen"),
			evaluated("suspended", "indeterminate"),
		]);
		expect(objective?.state).toBe("suspended");
		expect(objective?.state).not.toBe("accomplished");
		expect(objective?.state).not.toBe("failed");
	});

	it("leaves a partially satisfied objective active, not failed", () => {
		// The work that was done is still done. Failing here would throw it away.
		const objective = fold([
			statedEvent(),
			admittedEvent("frozen"),
			evaluated("active", "partial"),
		]);
		expect(objective?.state).toBe("active");
	});

	it("fails an objective whose criteria cannot be satisfied", () => {
		const objective = fold([
			statedEvent(),
			admittedEvent("frozen"),
			evaluated("failed", "not_accomplished"),
		]);
		expect(objective?.state).toBe("failed");
	});

	it("takes the most recent verdict when an objective is evaluated twice", () => {
		// Evaluation runs again after more work. A later verdict is the current
		// answer, and an earlier one is history rather than a competing claim.
		const objective = fold([
			statedEvent(),
			admittedEvent("frozen"),
			evaluated("active", "partial"),
			evaluated("accomplished"),
		]);
		expect(objective?.state).toBe("accomplished");
	});

	it("does not let a verdict move the frozen contract hash", () => {
		// Evaluation judges the contract. It does not get to change what it is
		// judging, which is the whole anti-Goodhart control.
		const objective = fold([statedEvent(), admittedEvent("frozen"), evaluated("accomplished")]);
		expect(objective?.contractHash).toBe("frozen");
	});
});
