/**
 * What may be remembered, and how far it counts.
 *
 * The promotion rule here is the contamination defence in `07-CONTEXT-MEMORY`
 * §5. Get it wrong in the permissive direction and one worker that reads a
 * malicious file writes a lesson every future worker retrieves. Get it wrong in
 * the strict direction and nothing is ever learned.
 */

import { describe, expect, it } from "vitest";
import { asContext, type MemoryRecord, mayPromote, scopeReaches } from "./memory.ts";

const record = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
	id: "mem_1",
	kind: "lesson",
	content: "running the tests before pushing has caught failures here",
	origin: "inferred",
	evidence: ["event:42"],
	confidence: 0.7,
	scope: "worker",
	scopeId: "worker:w1",
	author: "worker:w1",
	fromUntrusted: false,
	status: "active",
	contradictedBy: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	confirmations: [],
	...overrides,
});

describe("scopeReaches", () => {
	it("orders the scopes from narrowest to widest", () => {
		expect(scopeReaches("global", "objective")).toBe(true);
		expect(scopeReaches("project", "worker")).toBe(true);
		expect(scopeReaches("objective", "worker")).toBe(false);
	});
});

describe("mayPromote", () => {
	it("lets a worker's own lesson reach the project when somebody else confirms it", () => {
		const verdict = mayPromote({
			record: record({ confirmations: ["worker:w2"] }),
			to: "project",
			by: "worker:w2",
		});
		expect(verdict.allowed).toBe(true);
	});

	it("refuses a worker confirming its own lesson", () => {
		// The cheapest way to launder a belief into wider scope is to agree with
		// yourself, so that route is closed before any other check runs.
		const verdict = mayPromote({ record: record(), to: "project", by: "worker:w1" });
		expect(verdict.allowed).toBe(false);
		if (!verdict.allowed) expect(verdict.why).toContain("cannot be the one that confirms it");
	});

	it("refuses untrusted content travelling past the worker that read it", () => {
		// The contamination defence. A repository file said something, one worker
		// believed it, and nothing else has seen it. It stays with that worker.
		const verdict = mayPromote({
			record: record({ fromUntrusted: true, confirmations: [] }),
			to: "project",
			by: "worker:w2",
		});
		expect(verdict.allowed).toBe(false);
		if (!verdict.allowed) expect(verdict.why).toContain("no independent confirmation");
	});

	it("allows untrusted content once something independent confirms it", () => {
		const verdict = mayPromote({
			record: record({ fromUntrusted: true, confirmations: ["worker:w2"] }),
			to: "project",
			by: "worker:w2",
		});
		expect(verdict.allowed).toBe(true);
	});

	it("does not count the author's own confirmation as independent", () => {
		// Signing your own witness statement.
		const verdict = mayPromote({
			record: record({ fromUntrusted: true, confirmations: ["worker:w1"] }),
			to: "project",
			by: "worker:w2",
		});
		expect(verdict.allowed).toBe(false);
	});

	it("lets nothing but a human promote to global", () => {
		// However many workers agree. `07-CONTEXT-MEMORY` §5 gives global exactly
		// one route in, and consensus between workers is not it: they can all be
		// wrong together, and one poisoned context can produce several.
		const agreed = record({ confirmations: ["worker:w2", "worker:w3", "worker:w4"] });
		expect(mayPromote({ record: agreed, to: "global", by: "worker:w2" }).allowed).toBe(false);
		expect(mayPromote({ record: agreed, to: "global", by: "human:ash" }).allowed).toBe(true);
	});

	it("refuses to narrow scope, because that is not promotion", () => {
		const verdict = mayPromote({
			record: record({ scope: "project" }),
			to: "worker",
			by: "human:ash",
		});
		expect(verdict.allowed).toBe(false);
	});

	it("refuses to promote something already found wrong", () => {
		// A deprecated record is kept, because having believed something false is
		// worth knowing. Kept is not the same as usable.
		const verdict = mayPromote({
			record: record({ status: "deprecated", contradictedBy: "event:99" }),
			to: "project",
			by: "human:ash",
		});
		expect(verdict.allowed).toBe(false);
	});
});

describe("asContext", () => {
	it("says a lesson was inferred, in the sentence itself", () => {
		// `07-CONTEXT-MEMORY` §4: retrieval must never present inference as fact.
		// In the prose, not in a field beside it that a prompt builder can drop.
		expect(asContext(record({ origin: "inferred" }))).toContain("Inferred, and may be wrong");
	});

	it("distinguishes what a person said from what a worker decided", () => {
		expect(asContext(record({ origin: "asserted_by_human" }))).toContain("Stated by a person");
		expect(asContext(record({ origin: "asserted_by_worker" }))).toContain(
			"Asserted by a worker",
		);
	});

	it("says when something came from content nobody vouches for", () => {
		expect(asContext(record({ fromUntrusted: true }))).toContain("nobody vouches for");
	});

	it("says when something is held weakly", () => {
		expect(asContext(record({ confidence: 0.2 }))).toContain("held weakly");
		expect(asContext(record({ confidence: 0.9 }))).not.toContain("held weakly");
	});

	it("never presents a lesson and a stated fact identically", () => {
		// The whole point. Two records with the same words read differently
		// because they came to exist differently.
		const same = "the deploy script requires the VPN";
		expect(asContext(record({ content: same, origin: "inferred" }))).not.toBe(
			asContext(record({ content: same, origin: "asserted_by_human" })),
		);
	});
});
