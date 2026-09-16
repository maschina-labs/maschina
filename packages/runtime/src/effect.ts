/**
 * What happens when a run crashes after recording its intent and before recording the outcome.
 * Every kind of action declares which class it is.
 */

export type EffectClass =
	/** Safe to do again. */
	| "idempotent"
	/** Not safe to repeat, but the world can be asked whether it happened. Solana transactions are this. */
	| "reconcilable"
	/** Neither. Recovery stops and asks a person. */
	| "unsafe";

export type Recovery = "repeat" | "ask_the_world" | "ask_a_person";

export function recoveryFor(effect: EffectClass): Recovery {
	switch (effect) {
		case "idempotent":
			return "repeat";
		case "reconcilable":
			return "ask_the_world";
		case "unsafe":
			return "ask_a_person";
	}
}
