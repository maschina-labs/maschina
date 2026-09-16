import { MaschinaError } from "@maschina/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assertTransition, changesTheWorld, nextPhase, RUN_PHASES, type RunPhase } from "./run.ts";

describe("run phases", () => {
	it("walks the eight phases in order", () => {
		const walked: RunPhase[] = ["restore"];
		let phase = nextPhase("restore");
		while (phase) {
			walked.push(phase);
			phase = nextPhase(phase);
		}
		expect(walked).toEqual([...RUN_PHASES]);
	});

	it("records the intent before executing, and the outcome after", () => {
		expect(RUN_PHASES.indexOf("record_intent")).toBe(RUN_PHASES.indexOf("execute") - 1);
		expect(RUN_PHASES.indexOf("record_outcome")).toBe(RUN_PHASES.indexOf("execute") + 1);
		expect(RUN_PHASES.indexOf("authorize")).toBeLessThan(RUN_PHASES.indexOf("record_intent"));
	});

	it("only lets the world change while executing", () => {
		expect(RUN_PHASES.filter(changesTheWorld)).toEqual(["execute"]);
	});

	it("allows the defined early exits", () => {
		expect(() => assertTransition("decide", "skipped")).not.toThrow();
		expect(() => assertTransition("authorize", "refused")).not.toThrow();
		expect(() => assertTransition("assess", "finished")).not.toThrow();
		expect(() => assertTransition("execute", "failed")).not.toThrow();
	});

	it.each([
		["decide", "execute"],
		["authorize", "execute"],
		["restore", "decide"],
		["execute", "assess"],
		["record_intent", "skipped"],
		["execute", "refused"],
		["assess", "restore"],
		["decide", "finished"],
	] as const)("refuses %s to %s", (from, to) => {
		expect(() => assertTransition(from, to)).toThrow(MaschinaError);
	});

	it("never reaches execute without passing through authorize and record_intent", () => {
		const target = fc.constantFrom(...RUN_PHASES, "finished", "skipped", "refused", "failed");
		fc.assert(
			fc.property(fc.array(target, { maxLength: 20 }), (attempts) => {
				const seen: string[] = ["restore"];
				let current: RunPhase = "restore";
				for (const to of attempts) {
					try {
						assertTransition(current, to);
					} catch {
						continue;
					}
					seen.push(to);
					if (!(RUN_PHASES as readonly string[]).includes(to)) break;
					current = to as RunPhase;
				}
				const execute = seen.indexOf("execute");
				if (execute !== -1) {
					expect(seen.slice(0, execute)).toContain("authorize");
					expect(seen[execute - 1]).toBe("record_intent");
				}
			}),
		);
	});
});
