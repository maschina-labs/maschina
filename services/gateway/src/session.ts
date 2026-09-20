/**
 * Who is asking.
 *
 * Wallet sign-in (#78) fills this in with a real Solana signature. Until it lands there is one way to be
 * an owner, and it only exists outside production: a wallet named in the environment, which stands in
 * for a session while the web app is being built against a local gateway.
 *
 * It is deliberately awkward. The API is not exposed to the internet until sign-in is real.
 */

import { MaschinaError } from "@maschina/core";
import type { Owner } from "./routes/machines.ts";

export type Sessions = { ownerOf(headers: Headers): Promise<Owner | undefined> };

export function developmentSession(options: {
	production: boolean;
	ownerWallet?: string | undefined;
	ownerFor(walletAddress: string): Promise<Owner | undefined>;
}): Sessions {
	if (options.production && options.ownerWallet) {
		throw new MaschinaError(
			"invalid_input",
			"GATEWAY_DEV_OWNER_WALLET is a development stand-in and must not be set in production",
		);
	}

	return {
		async ownerOf(_headers: Headers) {
			if (options.production || !options.ownerWallet) return undefined;
			return options.ownerFor(options.ownerWallet);
		},
	};
}
