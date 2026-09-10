/**
 * The scoreboard is a fold, so it is tested the way a fold is: give it events,
 * check the numbers, and check that running it twice changes nothing.
 */

import { describe, expect, it } from "vitest";
import { scoreboard } from "./scoreboard.ts";

const at = (iso: string) => new Date(iso);

const event = (type: string, recordedAt: string, payload: Record<string, unknown> = {}) => ({
	type,
	recordedAt: at(recordedAt),
	payload,
});

describe("scoreboard", () => {
	it("counts nothing when nothing happened", () => {
		const board = scoreboard([]);
		expect(board.events).toBe(0);
		expect(board.days).toEqual([]);
		expect(board.streak).toBe(0);
	});

	it("counts what each event is, not what it looks like", () => {
		const board = scoreboard([
			event("objective.stated", "2026-09-10T10:00:00Z"),
			event("criterion.satisfied", "2026-09-10T10:01:00Z"),
			event("criterion.satisfied", "2026-09-10T10:02:00Z"),
			event("capability.denied", "2026-09-10T10:03:00Z"),
			event("effect.outcome", "2026-09-10T10:04:00Z"),
			event("capability.settled", "2026-09-10T10:05:00Z", { amount: 3_412 }),
		]);
		expect(board.objectivesStated).toBe(1);
		expect(board.criteriaSatisfied).toBe(2);
		expect(board.denials).toBe(1);
		expect(board.effects).toBe(1);
		expect(board.spent).toBe(3_412);
	});

	it("counts a question asked of a person, and not one waiting on a clock", () => {
		const board = scoreboard([
			event("worker.suspended", "2026-09-10T10:00:00Z", { kind: "question" }),
			event("worker.suspended", "2026-09-10T10:01:00Z", { kind: "until" }),
		]);
		expect(board.questionsAsked).toBe(1);
	});

	it("counts an answer only when somebody gave it", () => {
		const board = scoreboard([
			event("worker.resumed", "2026-09-10T10:00:00Z", { answeredBy: "human:ash" }),
			// Resumed by a clock. Nobody answered anything.
			event("worker.resumed", "2026-09-10T10:01:00Z", {}),
		]);
		expect(board.questionsAnswered).toBe(1);
	});

	it("counts a null step by the same rule the runtime uses", () => {
		const board = scoreboard([
			event("step.completed", "2026-09-10T10:00:00Z", {
				artifacts: [],
				observations: [],
				satisfied: [],
				changedTheWorld: false,
			}),
			event("step.completed", "2026-09-10T10:01:00Z", {
				artifacts: [],
				observations: ["learned something"],
				satisfied: [],
				changedTheWorld: false,
			}),
		]);
		expect(board.nullSteps).toBe(1);
	});

	it("is a fold, so it says the same thing twice", () => {
		const events = [
			event("objective.stated", "2026-09-10T10:00:00Z"),
			event("criterion.satisfied", "2026-09-10T11:00:00Z"),
		];
		expect(scoreboard(events)).toEqual(scoreboard(events));
	});

	describe("days and streaks", () => {
		it("buckets by local day", () => {
			const board = scoreboard([
				event("note.made", "2026-09-10T10:00:00"),
				event("note.made", "2026-09-10T23:00:00"),
				event("note.made", "2026-09-11T01:00:00"),
			]);
			expect(board.days.map((d) => d.events)).toEqual([2, 1]);
		});

		it("counts consecutive days back from today", () => {
			const now = at("2026-09-10T12:00:00");
			const board = scoreboard(
				[
					event("note.made", "2026-09-08T12:00:00"),
					event("note.made", "2026-09-09T12:00:00"),
					event("note.made", "2026-09-10T12:00:00"),
				],
				now,
			);
			expect(board.streak).toBe(3);
		});

		it("does not break a streak because today is not over", () => {
			const now = at("2026-09-10T09:00:00");
			const board = scoreboard(
				[event("note.made", "2026-09-08T12:00:00"), event("note.made", "2026-09-09T12:00:00")],
				now,
			);
			expect(board.streak).toBe(2);
		});

		it("breaks a streak when a day was missed", () => {
			const now = at("2026-09-10T12:00:00");
			const board = scoreboard(
				[event("note.made", "2026-09-07T12:00:00"), event("note.made", "2026-09-10T12:00:00")],
				now,
			);
			expect(board.streak).toBe(1);
		});
	});
});
