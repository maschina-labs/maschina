/**
 * How each devnet check is attempted against Turnkey (#19).
 *
 * A check that should be allowed must be signed and land on devnet. A check that should be refused is
 * never sent: if Turnkey signs it anyway, that alone is the failure, and nothing reaches the chain.
 */

import type { Check } from "./checklist.ts";
import type { SignOutcome } from "./providers/turnkey-signer.ts";
import type { Outcome } from "./run.ts";

export const TURNKEY_DEVNET_CHECKS: readonly string[] = [
	"transfer-owner",
	"transfer-outside",
	"swap-approved-tokens",
	"swap-unapproved-token",
	"unapproved-program",
	"under-size-limit",
	"over-size-limit",
];

export type Tools = {
	/** Builds the unsigned transaction for a check, as hex. */
	build(checkId: string): Promise<string>;
	sign(unsignedHex: string): Promise<SignOutcome>;
	/** Sends a signed transaction and waits for it to land. Returns its signature. */
	submit(signedHex: string): Promise<string>;
};

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function attemptFor(tools: Tools) {
	return async (check: Check): Promise<Outcome> => {
		if (!TURNKEY_DEVNET_CHECKS.includes(check.id)) {
			return { status: "error", message: `${check.id} has no devnet transaction yet` };
		}
		const signed = await tools.sign(await tools.build(check.id));
		if (signed.status === "refused") return { status: "refused", reason: signed.reason };
		if (signed.status === "error") return { status: "error", message: signed.message };
		if (check.expect === "refused") {
			return { status: "allowed", signature: "signed by Turnkey, deliberately not sent" };
		}
		try {
			return { status: "allowed", signature: await tools.submit(signed.signedHex) };
		} catch (error) {
			return { status: "error", message: `signed, but failed on devnet: ${describeError(error)}` };
		}
	};
}
