/**
 * How each devnet check is attempted against Crossmint (#23).
 *
 * Crossmint validates, signs and broadcasts in one call, so there is no way to stop after signing the
 * way the Turnkey checks do. A transaction Crossmint wrongly allows really lands on devnet. That is
 * harmless there: the forbidden transactions are a memo, tiny transfers, and transfers to the owner.
 */

import type { Check } from "./checklist.ts";
import type { Outcome } from "./run.ts";

export const CROSSMINT_DEVNET_CHECKS: readonly string[] = [
	"transfer-owner",
	"transfer-outside",
	"swap-approved-tokens",
	"swap-unapproved-token",
	"unapproved-program",
	"under-size-limit",
	"over-size-limit",
];

/** Sends the check's transaction through Crossmint and returns its signature, or throws. */
export type CrossmintPlans = Record<string, () => Promise<string>>;

/** Returns why Crossmint refused, or undefined when the error isn't a refusal. */
export type RefusalClassifier = (error: unknown) => string | undefined;

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function crossmintAttempt(plans: CrossmintPlans, classify: RefusalClassifier) {
	return async (check: Check): Promise<Outcome> => {
		const plan = plans[check.id];
		if (!plan) return { status: "error", message: `${check.id} has no Crossmint transaction yet` };
		try {
			return { status: "allowed", signature: await plan() };
		} catch (error) {
			const refusal = classify(error);
			return refusal
				? { status: "refused", reason: refusal }
				: { status: "error", message: describeError(error) };
		}
	};
}
