/**
 * The ranking.
 *
 * Three signals, and `07-CONTEXT-MEMORY` §6 says optimising any one alone fails
 * distinctly. These tests are mostly about that: each signal on its own puts the
 * wrong thing first, and the blend is what stops it.
 */

import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "./memory.ts";
import { bySharedWords, rank, recencyOf, reliabilityOf } from "./retrieval.ts";

const NOW = new Date("2026-06-01T00:00:00Z");

const record = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
	id: "mem_1",
	kind: "lesson",
	content: "running the test suite before pushing catches failures",
	origin: "inferred",
	evidence: ["event:1"],
	confidence: 0.8,
	scope: "project",
	scopeId: "project:x",
	author: "worker:a",
	fromUntrusted: false,
	status: "active",
	contradictedBy: null,
	createdAt: NOW,
	confirmations: [],
	...overrides,
});

describe("bySharedWords", () => {
	it("scores overlap between the question and the content", () => {
		expect(bySharedWords.score("test suite failures", record())).toBeGreaterThan(0.5);
		expect(bySharedWords.score("database migrations", record())).toBe(0);
	});

	it("ignores short words, which match everything", () => {
		expect(bySharedWords.score("the and but", record())).toBe(0);
	});

	it("says what it is, so a ranking can be read knowing how it was made", () => {
		// The mechanism is swappable and its identity travels with every score,
		// so a ranking made by shared words is never mistaken for one made by
		// embeddings.
		expect(bySharedWords.name).toBe("shared-words");
	});
});

describe("recencyOf", () => {
	it("is one for something written now", () => {
		expect(recencyOf(record(), NOW)).toBe(1);
	});

	it("halves over the half life", () => {
		const old = record({ createdAt: new Date("2026-05-02T00:00:00Z") });
		expect(recencyOf(old, NOW, 30)).toBeCloseTo(0.5, 1);
	});

	it("keeps falling rather than reaching zero, so old things can still win", () => {
		const ancient = record({ createdAt: new Date("2020-01-01T00:00:00Z") });
		const score = recencyOf(ancient, NOW);
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(0.01);
	});
});

describe("reliabilityOf", () => {
	it("trusts something derived from the log more than an inference", () => {
		expect(reliabilityOf(record({ origin: "derived" }))).toBeGreaterThan(
			reliabilityOf(record({ origin: "inferred" })),
		);
	});

	it("trusts a person more than a worker", () => {
		expect(reliabilityOf(record({ origin: "asserted_by_human" }))).toBeGreaterThan(
			reliabilityOf(record({ origin: "asserted_by_worker" })),
		);
	});

	it("raises reliability when others have seen the same thing", () => {
		expect(reliabilityOf(record({ confirmations: ["worker:b", "worker:c"] }))).toBeGreaterThan(
			reliabilityOf(record({ confirmations: [] })),
		);
	});

	it("does not let agreement turn an inference into an observation", () => {
		// Three workers agreeing about a guess is still a guess, so a confirmed
		// inference must stay below something derived from the log.
		const agreed = reliabilityOf(record({ confirmations: ["b", "c", "d"] }));
		expect(agreed).toBeLessThan(reliabilityOf(record({ origin: "derived", confidence: 1 })));
	});

	it("discounts anything that came from content nobody vouches for", () => {
		expect(reliabilityOf(record({ fromUntrusted: true }))).toBeLessThan(
			reliabilityOf(record({ fromUntrusted: false })),
		);
	});
});

describe("rank", () => {
	it("keeps every component, not just the total", () => {
		// The reason the slice exists. A single blended number cannot tell a bad
		// retrieval apart from bad reasoning about a good one.
		const [top] = rank("test failures", [record()], { now: NOW });
		expect(top).toMatchObject({
			relevance: expect.any(Number),
			recency: expect.any(Number),
			reliability: expect.any(Number),
			score: expect.any(Number),
		});
	});

	it("returns what it rejected as well as what it chose", () => {
		// "Why did the worker see this and not that" cannot be answered from the
		// winners alone.
		const many = Array.from({ length: 8 }, (_, i) =>
			record({ id: `mem_${i}`, content: `something about topic ${i}` }),
		);
		const ranked = rank("topic 3", many, { now: NOW, take: 2 });
		expect(ranked).toHaveLength(8);
		expect(ranked.filter((r) => r.selected)).toHaveLength(2);
		expect(ranked.filter((r) => !r.selected)).toHaveLength(6);
	});

	it("does not let relevance alone decide", () => {
		// A perfectly relevant guess against a slightly less relevant confirmed
		// fact. `07-CONTEXT-MEMORY` §6: a high-confidence confirmed fact should
		// outrank a marginally more similar low-confidence inference.
		const relevantGuess = record({
			id: "guess",
			content: "deployments always fail on friday",
			origin: "inferred",
			confidence: 0.3,
		});
		const solidFact = record({
			id: "fact",
			content: "deployments fail when the migration lock is held",
			origin: "asserted_by_human",
			confidence: 1,
			confirmations: ["worker:b", "worker:c", "worker:d"],
		});
		const ranked = rank("deployments fail", [relevantGuess, solidFact], { now: NOW });
		expect(ranked[0]?.record.id).toBe("fact");
	});

	it("does not let recency alone decide", () => {
		const freshGuess = record({
			id: "fresh",
			content: "unrelated words entirely",
			createdAt: NOW,
			origin: "inferred",
			confidence: 0.2,
		});
		const olderMatch = record({
			id: "older",
			content: "the migration lock causes deployment failures",
			createdAt: new Date("2026-05-20T00:00:00Z"),
			origin: "asserted_by_human",
			confidence: 1,
		});
		const ranked = rank("migration lock deployment failures", [freshGuess, olderMatch], {
			now: NOW,
		});
		expect(ranked[0]?.record.id).toBe("older");
	});

	it("is stable: the same inputs rank the same way", () => {
		const records = [record({ id: "a" }), record({ id: "b", content: "different words here" })];
		expect(rank("words", records, { now: NOW })).toEqual(rank("words", records, { now: NOW }));
	});

	it("handles having nothing to rank", () => {
		expect(rank("anything", [], { now: NOW })).toEqual([]);
	});
});
