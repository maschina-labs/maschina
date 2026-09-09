/**
 * Runtime configuration.
 *
 * `04-WORKERS` §7 is specific: "The mapping from class to concrete model is
 * runtime configuration, changeable without touching any definition. When a
 * provider ships something new, one config entry changes and every worker
 * benefits."
 *
 * It was a constant in `model.ts`, which meant every capability ever granted
 * pointed at a model that could only be changed by editing and redeploying code.
 * The abstraction was in the type and not in the system.
 *
 * Everything here reads from the environment with a documented default, so the
 * default is visible rather than hidden and changing it needs no rebuild. The
 * numbers are stated in micro-dollars of list value, which is the unit the log
 * records (`ADR-009` §3).
 */

import type { ModelClass } from "@maschina/core";

function number(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw === "") return fallback;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		// A budget misread as NaN would silently become "no limit", so this stops
		// rather than falling back to the default it was being told to replace.
		throw new Error(`${name} must be a whole number of micro-dollars, got ${raw}`);
	}
	return parsed;
}

/**
 * Which concrete model answers for a class.
 *
 * Override one with `MASCHINA_MODEL_FAST`, `MASCHINA_MODEL_REASONING`, and so on.
 * `embedding` has no default on purpose: the provider does not produce
 * embeddings, and mapping it to a chat model to avoid an empty cell would answer
 * an embedding request with prose.
 */
export function modelFor(modelClass: ModelClass): string | undefined {
	const defaults: Partial<Record<ModelClass, string>> = {
		fast: "claude-haiku-4-5-20251001",
		reasoning: "claude-opus-5",
		code: "claude-sonnet-5",
		long_context: "claude-sonnet-5",
	};
	return process.env[`MASCHINA_MODEL_${modelClass.toUpperCase()}`] ?? defaults[modelClass];
}

/**
 * What one model call is assumed to cost until it settles.
 *
 * Roughly ten times a small contained call, so an ordinary call settles well
 * under its reservation rather than over it. Override with
 * `MASCHINA_CALL_ESTIMATE`.
 */
export const callEstimate = (): number => number("MASCHINA_CALL_ESTIMATE", 20_000);
