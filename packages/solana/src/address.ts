import { MaschinaError } from "@maschina/core";
import { type Address, isAddress } from "@solana/kit";

export type { Address } from "@solana/kit";

/** Checks untrusted input is a Solana address before it is used as one. */
export function parseAddress(value: string): Address {
	if (!isAddress(value)) {
		throw new MaschinaError("invalid_input", "not a valid Solana address");
	}
	return value;
}
