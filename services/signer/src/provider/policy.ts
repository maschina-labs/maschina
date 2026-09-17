/**
 * The machine wallet policy every provider enforces, and the checks it passes before reaching one.
 *
 * Providers turn these values into their own policy language. An address containing a quote could
 * rewrite a policy expression, so every value is checked to be a real Solana address first.
 */

import { err, ok, type Result } from "@maschina/core";
import { type ProviderError, providerError } from "./wallet-provider.ts";

/** A base58 Solana address. */
export type SolanaAddress = string;

export type WalletPolicy = {
	/** The only address funds may always go to. */
	readonly owner: SolanaAddress;
	/** Other approved recipients, such as a payment machine's payees. Sorted, never the owner. */
	readonly recipients: readonly SolanaAddress[];
	/** Programs a transaction may call. Sorted. */
	readonly approvedPrograms: readonly SolanaAddress[];
	/** Token mints a transfer may move. Sorted. */
	readonly approvedMints: readonly SolanaAddress[];
	/** The most SOL, in lamports, one transfer may move. */
	readonly maxLamportsPerTransfer: bigint;
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** True when the value is base58 and decodes to exactly 32 bytes, as every Solana address does. */
export function isSolanaAddress(value: string): boolean {
	if (value.length < 32 || value.length > 44) return false;
	let number = 0n;
	for (const char of value) {
		const digit = BASE58.indexOf(char);
		if (digit < 0) return false;
		number = number * 58n + BigInt(digit);
	}
	const leadingZeros = value.length - value.replace(/^1+/, "").length;
	const bytes = number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
	return leadingZeros + bytes === 32;
}

const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort();

function badAddress(field: string, values: readonly string[]): ProviderError | undefined {
	const bad = values.find((value) => !isSolanaAddress(value));
	return bad === undefined
		? undefined
		: providerError("invalid", `${field} contains something that isn't a Solana address`, {
				field,
			});
}

/** Checks a recipient list on its own, for updates. */
export function validateRecipients(
	owner: SolanaAddress,
	recipients: readonly string[],
): Result<readonly SolanaAddress[], ProviderError> {
	const problem = badAddress("recipients", recipients);
	if (problem) return err(problem);
	return ok(sortedUnique(recipients).filter((r) => r !== owner));
}

/** Returns the policy in its stored form, or why it can't be used. */
export function validatePolicy(policy: WalletPolicy): Result<WalletPolicy, ProviderError> {
	for (const [field, values] of [
		["owner", [policy.owner]],
		["approvedPrograms", policy.approvedPrograms],
		["approvedMints", policy.approvedMints],
	] as const) {
		const problem = badAddress(field, values);
		if (problem) return err(problem);
	}
	if (policy.approvedPrograms.length === 0) {
		return err(providerError("invalid", "approvedPrograms is empty, so nothing could be signed"));
	}
	if (policy.maxLamportsPerTransfer <= 0n) {
		return err(providerError("invalid", "maxLamportsPerTransfer must be more than zero"));
	}
	const recipients = validateRecipients(policy.owner, policy.recipients);
	if (!recipients.ok) return recipients;
	return ok({
		owner: policy.owner,
		recipients: recipients.value,
		approvedPrograms: sortedUnique(policy.approvedPrograms),
		approvedMints: sortedUnique(policy.approvedMints),
		maxLamportsPerTransfer: policy.maxLamportsPerTransfer,
	});
}
