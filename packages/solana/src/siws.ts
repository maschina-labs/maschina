/**
 * Signing in with a Solana wallet.
 *
 * A wallet proves who it is by signing a sentence, not a transaction. The sentence says who is asking,
 * which account is answering, that nothing is being approved, and when the offer stops being valid. A
 * person reads it in their wallet before they approve it, so it is written to be read.
 *
 * Four things have to be true before a signature means somebody is signed in:
 *
 *   1. the message names this domain, so a signature collected elsewhere cannot be replayed here
 *   2. the nonce is the one this server handed out, so an old message cannot be presented again
 *   3. the moment is inside the window the message itself states
 *   4. the signature is that account's, over exactly these bytes
 *
 * The nonce being single use is enforced by whoever handed it out, since that needs somewhere to
 * remember it. Everything else is decided here, from the message alone.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import {
	getAddressEncoder,
	getBase58Encoder,
	type Address as KitAddress,
	verifySignature,
} from "@solana/kit";

/** A browser and a server rarely agree on the time to the second. */
const CLOCK_DRIFT_MS = 30_000;

export type SignInRequest = {
	domain: string;
	uri: string;
	address: string;
	nonce: string;
	issuedAt: Date;
	expiresAt: Date;
};

export type SignedIn = {
	address: string;
	nonce: string;
	issuedAt: Date;
	expiresAt: Date;
};

/** The exact text a wallet is asked to sign. Rebuilt byte for byte when it comes back. */
export function signInMessage(request: SignInRequest): string {
	return [
		`${request.domain} wants you to sign in with your Solana account:`,
		request.address,
		"",
		"Sign in to Maschina. This does not approve any transaction, moves no funds, and costs nothing.",
		"",
		`URI: ${request.uri}`,
		"Version: 1",
		`Nonce: ${request.nonce}`,
		`Issued At: ${request.issuedAt.toISOString()}`,
		`Expiration Time: ${request.expiresAt.toISOString()}`,
	].join("\n");
}

const FIELDS = {
	domain: /^(\S+) wants you to sign in with your Solana account:$/,
	nonce: /^Nonce: (.+)$/,
	issuedAt: /^Issued At: (.+)$/,
	expiresAt: /^Expiration Time: (.+)$/,
} as const;

type Parsed = { domain: string; address: string; nonce: string; issuedAt: Date; expiresAt: Date };

function parse(message: string): Parsed | undefined {
	const lines = message.split("\n");
	const [heading, address] = lines;
	const domain = heading?.match(FIELDS.domain)?.[1];
	if (!domain || !address) return undefined;

	const find = (pattern: RegExp) => {
		for (const line of lines) {
			const found = line.match(pattern)?.[1];
			if (found) return found;
		}
		return undefined;
	};

	const nonce = find(FIELDS.nonce);
	const issued = find(FIELDS.issuedAt);
	const expires = find(FIELDS.expiresAt);
	if (!nonce || !issued || !expires) return undefined;

	const issuedAt = new Date(issued);
	const expiresAt = new Date(expires);
	if (Number.isNaN(issuedAt.getTime()) || Number.isNaN(expiresAt.getTime())) return undefined;

	return { domain, address, nonce, issuedAt, expiresAt };
}

export type VerifyRequest = {
	message: string;
	/** Base58, as every Solana wallet returns it. */
	signature: string;
	/** The domain this server answers for. */
	domain: string;
	/** The nonce this server handed out for this attempt. */
	nonce: string;
	now: Date;
};

const refuse = (why: string, details?: Record<string, unknown>) =>
	err(
		new MaschinaError("unauthenticated", why, {
			...(details === undefined ? {} : { details }),
		}),
	);

export async function verifySignIn(
	request: VerifyRequest,
): Promise<Result<SignedIn, MaschinaError>> {
	const parsed = parse(request.message);
	if (!parsed) return refuse("that is not a sign in message");

	if (parsed.domain !== request.domain) {
		// A signature collected by somebody else's site says nothing about this one.
		return refuse("that message was addressed to another site", { domain: parsed.domain });
	}
	if (parsed.nonce !== request.nonce) {
		return refuse("that message answers a different sign in attempt");
	}
	if (request.now.getTime() >= parsed.expiresAt.getTime()) {
		return refuse("that sign in message has expired");
	}
	if (request.now.getTime() + CLOCK_DRIFT_MS < parsed.issuedAt.getTime()) {
		return refuse("that message is dated in the future");
	}

	const verified = await verifyBytes(parsed.address, request.signature, request.message);
	if (!verified) return refuse("that signature is not this wallet's");

	return ok({
		address: parsed.address,
		nonce: parsed.nonce,
		issuedAt: parsed.issuedAt,
		expiresAt: parsed.expiresAt,
	});
}

/** Ed25519, over the exact bytes of the message, against the public key the address is made of. */
async function verifyBytes(address: string, signature: string, message: string): Promise<boolean> {
	try {
		const publicKey = getAddressEncoder().encode(address as KitAddress);
		const key = await crypto.subtle.importKey("raw", publicKey, "Ed25519", true, ["verify"]);
		const bytes = getBase58Encoder().encode(signature);
		if (bytes.length !== 64) return false;
		return await verifySignature(
			key,
			bytes as Parameters<typeof verifySignature>[1],
			new TextEncoder().encode(message),
		);
	} catch {
		// A malformed address or signature is a refusal, not a crash.
		return false;
	}
}
