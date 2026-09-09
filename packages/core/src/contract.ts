/**
 * Freezing and validating a completion contract. 09-EVALUATION §2.
 *
 * Two jobs, both pure:
 *
 *   validateContract  the admission gate. What makes a contract admissible.
 *   hashContract      the freeze. What makes the target unable to move.
 */

import { createHash } from "node:crypto";
import type { Contract, Criterion, VerificationStrength } from "./objective.ts";

const STRENGTHS: readonly VerificationStrength[] = [
	"mechanical",
	"differential",
	"independent",
	"human",
];

/**
 * Deterministic JSON. Object keys sorted, no incidental whitespace.
 *
 * Without this the freeze is decorative: the same contract written with its keys
 * in a different order would hash differently, so a hash mismatch would prove
 * nothing about whether the criteria changed.
 */
function canonicalize(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
	return `{${entries.join(",")}}`;
}

/**
 * The frozen identity of a contract. Recorded at admission and never recomputed
 * from a later version, because recomputing is exactly how the target moves.
 */
export function hashContract(contract: Contract): string {
	return createHash("sha256").update(canonicalize(contract)).digest("hex");
}

/** The canonical form itself, for anyone who needs to see what was hashed. */
export function canonicalContract(contract: Contract): string {
	return canonicalize(contract);
}

function validateCriterion(criterion: Criterion, index: number): string[] {
	const where = `criteria[${index}]`;
	const problems: string[] = [];

	if (!criterion.id?.trim()) problems.push(`${where}: needs an id`);
	if (!criterion.criterion?.trim()) problems.push(`${where}: needs a condition`);

	// The mechanical proxy for "not vague". We cannot detect that "make the code
	// better" is unverifiable, but we can insist that whoever wrote it says how
	// it gets checked. A criterion with no verification method is the shape that
	// failure takes.
	if (!criterion.verifyBy?.trim()) {
		problems.push(`${where}: needs verifyBy, saying how this is checked`);
	}

	if (!STRENGTHS.includes(criterion.strength)) {
		problems.push(
			`${where}: strength must be one of ${STRENGTHS.join(", ")}, got ${String(criterion.strength)}`,
		);
	}

	if (!Array.isArray(criterion.evidence) || criterion.evidence.length === 0) {
		problems.push(`${where}: needs at least one item of required evidence`);
	}

	return problems;
}

/**
 * Whether a contract may be admitted. Returns every problem, not the first,
 * because a human fixing a contract should see the whole list once.
 */
export function validateContract(contract: Contract): string[] {
	const problems: string[] = [];

	if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
		problems.push("a contract needs at least one criterion");
	} else {
		contract.criteria.forEach((criterion, index) => {
			problems.push(...validateCriterion(criterion, index));
		});

		const ids = contract.criteria.map((c) => c.id);
		const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
		if (duplicates.length > 0) {
			// Verdicts are recorded per criterion id. Duplicates would make a
			// verdict ambiguous about what it judged.
			problems.push(`duplicate criterion ids: ${[...new Set(duplicates)].join(", ")}`);
		}
	}

	if (!Array.isArray(contract.nonGoals)) problems.push("nonGoals must be an array");
	if (!Array.isArray(contract.failureConditions)) {
		problems.push("failureConditions must be an array");
	}

	return problems;
}
