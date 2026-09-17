/**
 * The interface between the signer and a wallet provider (D-064).
 *
 * The signer checks Maschina's own rules first. The provider holds the key and enforces the wallet's
 * policy as a second, independent check. Nothing outside `src/provider/` knows which provider is in
 * use, so replacing Turnkey means writing one new adapter that passes `contract.ts`.
 *
 * Transactions cross this boundary as serialized bytes, because Solana libraries live only in
 * `packages/solana`.
 *
 * Every method returns a Result and never throws for a failure the provider reports. The errors:
 *
 * | Kind          | Meaning                                                        | Retry? |
 * | ------------- | -------------------------------------------------------------- | ------ |
 * | `refused`     | The wallet's policy said no. The transaction was not signed     | No     |
 * | `not_found`   | No wallet with that id                                          | No     |
 * | `invalid`     | The request was malformed: a bad address, a bad policy, bytes the provider can't read | No |
 * | `unavailable` | The provider couldn't be reached or is rate limiting            | Yes    |
 * | `unexpected`  | Anything else. Treated as a bug until understood                | No     |
 *
 * There is deliberately no way to export a key.
 */

import { MaschinaError, type Result } from "@maschina/core";
import type { SolanaAddress, WalletPolicy } from "./policy.ts";

export type ProviderErrorKind = "refused" | "not_found" | "invalid" | "unavailable" | "unexpected";

export type ProviderError = {
	readonly kind: ProviderErrorKind;
	readonly message: string;
	readonly retryable: boolean;
	readonly details: Readonly<Record<string, unknown>>;
	readonly cause?: unknown;
};

export function providerError(
	kind: ProviderErrorKind,
	message: string,
	details: Record<string, unknown> = {},
	cause?: unknown,
): ProviderError {
	return {
		kind,
		message,
		retryable: kind === "unavailable",
		details,
		...(cause === undefined ? {} : { cause }),
	};
}

const CODES = {
	refused: "forbidden",
	not_found: "not_found",
	invalid: "invalid_input",
	unavailable: "unavailable",
	unexpected: "internal",
} as const;

/** The same failure as a MaschinaError, for code that reports errors outward. */
export function toMaschinaError(error: ProviderError): MaschinaError {
	return new MaschinaError(CODES[error.kind], error.message, {
		details: { providerErrorKind: error.kind, ...error.details },
		cause: error.cause,
	});
}

type ProviderWallet = {
	/** The provider's own id for the wallet. */
	readonly walletId: string;
	readonly address: SolanaAddress;
};

type ProviderResult<T> = Promise<Result<T, ProviderError>>;

export interface WalletProvider {
	readonly name: string;
	/** Creates a wallet with its policy attached. The policy is read back before this succeeds. */
	createWallet(input: { label: string; policy: WalletPolicy }): ProviderResult<ProviderWallet>;
	/** The policy the provider is enforcing now, as stored by the provider. */
	readPolicy(walletId: string): ProviderResult<WalletPolicy>;
	/** Signs an unsigned transaction, or refuses it under the wallet's policy. Never sends it. */
	sign(walletId: string, unsignedTransaction: Uint8Array): ProviderResult<Uint8Array>;
	/** Replaces the approved recipients (besides the owner) in place, and returns the stored policy. */
	setRecipients(
		walletId: string,
		recipients: readonly SolanaAddress[],
	): ProviderResult<WalletPolicy>;
}
