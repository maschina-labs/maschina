import { describe, expect, it } from "vitest";
import { canonicalContract, hashContract, validateContract } from "./contract.ts";
import type { Contract, Criterion } from "./objective.ts";

function criterion(overrides: Partial<Criterion> = {}): Criterion {
	return {
		id: "c1",
		criterion: "The parser handles nested arrays",
		verifyBy: "tests/parser/nested.ts passes",
		strength: "mechanical",
		evidence: ["the test output"],
		...overrides,
	};
}

function contract(overrides: Partial<Contract> = {}): Contract {
	return {
		criteria: [criterion()],
		nonGoals: [],
		failureConditions: [],
		...overrides,
	};
}

describe("hashContract", () => {
	it("is the same for the same contract written with keys in a different order", () => {
		// If this fails the freeze is decorative: a hash mismatch would prove
		// nothing about whether the criteria actually changed.
		const a: Contract = {
			criteria: [
				{
					id: "c1",
					criterion: "x",
					verifyBy: "y",
					strength: "mechanical",
					evidence: ["e"],
				},
			],
			nonGoals: ["n"],
			failureConditions: ["f"],
		};
		const b = {
			failureConditions: ["f"],
			nonGoals: ["n"],
			criteria: [
				{ evidence: ["e"], strength: "mechanical", verifyBy: "y", criterion: "x", id: "c1" },
			],
		} as Contract;

		expect(hashContract(a)).toBe(hashContract(b));
	});

	it("changes when any part of the contract changes", () => {
		const base = contract();
		expect(hashContract(base)).not.toBe(hashContract(contract({ nonGoals: ["no"] })));
		expect(hashContract(base)).not.toBe(
			hashContract(contract({ failureConditions: ["nope"] })),
		);
		expect(hashContract(base)).not.toBe(
			hashContract(contract({ criteria: [criterion({ criterion: "something else" })] })),
		);
		expect(hashContract(base)).not.toBe(
			hashContract(contract({ criteria: [criterion({ strength: "human" })] })),
		);
	});

	it("is stable across runs", () => {
		// A known vector. If this changes, every previously frozen contract stops
		// verifying, which is a breaking change to the record and not a refactor.
		expect(hashContract(contract())).toBe(
			"643e6bcc7c44e4057e6276b92a88de2c39a5454c09b8c221f3852c2bc1c44634",
		);
	});

	it("distinguishes criteria order, because order is part of the contract", () => {
		const one = contract({ criteria: [criterion({ id: "a" }), criterion({ id: "b" })] });
		const two = contract({ criteria: [criterion({ id: "b" }), criterion({ id: "a" })] });
		expect(hashContract(one)).not.toBe(hashContract(two));
	});

	it("ignores undefined fields rather than hashing their absence differently", () => {
		const withUndefined = { ...contract(), somethingUndefined: undefined } as Contract;
		expect(hashContract(withUndefined)).toBe(hashContract(contract()));
	});
});

describe("canonicalContract", () => {
	it("sorts object keys", () => {
		expect(canonicalContract(contract())).toContain('"criteria"');
		const canonical = canonicalContract(contract());
		expect(canonical.indexOf('"criteria"')).toBeLessThan(
			canonical.indexOf('"failureConditions"'),
		);
		expect(canonical.indexOf('"failureConditions"')).toBeLessThan(
			canonical.indexOf('"nonGoals"'),
		);
	});
});

describe("validateContract", () => {
	it("accepts a well formed contract", () => {
		expect(validateContract(contract())).toEqual([]);
	});

	it("rejects a contract with no criteria", () => {
		// If we cannot say what would count as done, we are not ready to start.
		expect(validateContract(contract({ criteria: [] }))).toContain(
			"a contract needs at least one criterion",
		);
	});

	it("rejects a criterion that does not say how it is checked", () => {
		// The mechanical proxy for "not vague". We cannot detect that "make the
		// code better" is unverifiable, but we can insist someone says how.
		const problems = validateContract(
			contract({ criteria: [criterion({ criterion: "Make the code better", verifyBy: "" })] }),
		);
		expect(problems.some((p) => p.includes("needs verifyBy"))).toBe(true);
	});

	it("rejects an unknown verification strength", () => {
		const problems = validateContract(
			contract({
				criteria: [criterion({ strength: "vibes" as unknown as Criterion["strength"] })],
			}),
		);
		expect(problems.some((p) => p.includes("strength must be one of"))).toBe(true);
	});

	it("rejects self-assessment, which is never sufficient on its own", () => {
		// 09-EVALUATION §3. A worker reporting that it is done is never the basis
		// for marking an objective accomplished, so a contract cannot ask for it.
		const problems = validateContract(
			contract({
				criteria: [
					criterion({ strength: "self-assessment" as unknown as Criterion["strength"] }),
				],
			}),
		);
		expect(problems.some((p) => p.includes("strength must be one of"))).toBe(true);
	});

	it("rejects a criterion with no required evidence", () => {
		const problems = validateContract(contract({ criteria: [criterion({ evidence: [] })] }));
		expect(problems.some((p) => p.includes("required evidence"))).toBe(true);
	});

	it("rejects duplicate criterion ids", () => {
		// Verdicts are recorded per criterion id, so duplicates make a verdict
		// ambiguous about what it judged.
		const problems = validateContract(
			contract({ criteria: [criterion({ id: "same" }), criterion({ id: "same" })] }),
		);
		expect(problems.some((p) => p.includes("duplicate criterion ids: same"))).toBe(true);
	});

	it("reports every problem at once, not just the first", () => {
		// Someone fixing a contract should see the whole list in one pass.
		const problems = validateContract(
			contract({
				criteria: [criterion({ verifyBy: "", evidence: [], id: "" })],
			}),
		);
		expect(problems.length).toBeGreaterThanOrEqual(3);
	});

	it("names which criterion is at fault", () => {
		const problems = validateContract(
			contract({ criteria: [criterion(), criterion({ id: "c2", verifyBy: "" })] }),
		);
		expect(problems.some((p) => p.startsWith("criteria[1]"))).toBe(true);
	});
});
