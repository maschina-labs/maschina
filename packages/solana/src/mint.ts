/**
 * Reading a token's mint account: how many decimals it has, how much exists, and who still has power
 * over it.
 *
 * Decimals decide what an amount means. Treating a 6 decimal token as a 9 decimal one is a thousandfold
 * mistake in the direction that loses money, so decimals are read from the chain and never trusted from
 * a list, a label or a URL.
 *
 * The authorities are read at the same time because they are the difference between a token and a trap:
 * a freeze authority can stop a holder selling, and a mint authority can print more of what a machine
 * just bought. Nothing here refuses a token for having them, that judgement belongs to the rules. This
 * only reports what is true.
 */

import { MaschinaError } from "@maschina/core";
import { type Address, parseAddress } from "./address.ts";

/** The programs a real token mint belongs to. An account owned by anything else is not a mint. */
const TOKEN_PROGRAMS: Record<string, TokenProgram> = {
	TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "token",
	TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "token-2022",
};

export type TokenProgram = "token" | "token-2022";

/** An account as an RPC returns it with `jsonParsed` encoding, narrowed to what is read here. */
export type FetchedAccount = {
	owner: string;
	data: unknown;
};

/** Reads one account. Returns nothing when the account does not exist. */
export type AccountReader = {
	read(address: Address): Promise<FetchedAccount | undefined>;
};

export type MintDetails = {
	mint: Address;
	program: TokenProgram;
	/** How many of the token's smallest units make one whole token. */
	decimals: number;
	supply: bigint;
	/** Set when someone can still create more of this token. */
	mintAuthority?: Address;
	/** Set when someone can freeze a holder's account, which is how selling gets blocked. */
	freezeAuthority?: Address;
	/** Token-2022 extensions by name, which change how transfers behave. Empty for a plain token. */
	extensions: string[];
};

/** The largest number of decimals Maschina will work with, matching the amount arithmetic in core. */
const MAX_DECIMALS = 18;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const optionalAddress = (value: unknown, field: string): Address | undefined => {
	if (value === null || value === undefined) return undefined;
	if (typeof value !== "string") {
		throw new MaschinaError("invalid_input", `${field} is not an address`);
	}
	return parseAddress(value);
};

/** The extension names a Token-2022 mint declares, ignoring anything shaped unexpectedly. */
function extensionNames(info: Record<string, unknown>): string[] {
	const declared = info["extensions"];
	if (!Array.isArray(declared)) return [];
	const names: string[] = [];
	for (const entry of declared) {
		const name = asRecord(entry)?.["extension"];
		if (typeof name === "string") names.push(name);
	}
	return names;
}

/**
 * Turns a fetched account into mint details, refusing anything that is not an initialised mint.
 *
 * Every field is checked rather than cast. This is untrusted input: an RPC node can return whatever it
 * likes, and a machine acts on what comes back.
 */
export function parseMint(mint: Address, account: FetchedAccount): MintDetails {
	const program = TOKEN_PROGRAMS[account.owner];
	if (!program) {
		throw new MaschinaError("invalid_input", "this address is not a token mint", {
			details: { mint, owner: account.owner },
		});
	}

	const parsed = asRecord(asRecord(account.data)?.["parsed"]);
	if (parsed?.["type"] !== "mint") {
		throw new MaschinaError("invalid_input", "this account is not a mint", {
			details: { mint },
		});
	}

	const info = asRecord(parsed["info"]);
	if (!info)
		throw new MaschinaError("invalid_input", "the mint has no details", { details: { mint } });

	if (info["isInitialized"] !== true) {
		throw new MaschinaError("invalid_input", "this mint is not initialised", { details: { mint } });
	}

	const decimals = info["decimals"];
	if (typeof decimals !== "number" || !Number.isInteger(decimals)) {
		throw new MaschinaError("invalid_input", "the mint's decimals are not a whole number", {
			details: { mint, decimals },
		});
	}
	if (decimals < 0 || decimals > MAX_DECIMALS) {
		throw new MaschinaError("invalid_input", `the mint's decimals are out of range (${decimals})`, {
			details: { mint },
		});
	}

	const supply = info["supply"];
	// Supply arrives as a string because it does not fit a JavaScript number. Anything else is a lie.
	if (typeof supply !== "string" || !/^\d+$/.test(supply)) {
		throw new MaschinaError("invalid_input", "the mint's supply is not a whole number", {
			details: { mint, supply },
		});
	}

	const mintAuthority = optionalAddress(info["mintAuthority"], "the mint authority");
	const freezeAuthority = optionalAddress(info["freezeAuthority"], "the freeze authority");

	return {
		mint,
		program,
		decimals,
		supply: BigInt(supply),
		...(mintAuthority ? { mintAuthority } : {}),
		...(freezeAuthority ? { freezeAuthority } : {}),
		extensions: extensionNames(info),
	};
}

/** Reads a mint from the chain, or says it does not exist. */
export async function readMint(reader: AccountReader, mint: Address): Promise<MintDetails> {
	const account = await reader.read(mint);
	if (!account) {
		throw new MaschinaError("not_found", "no account exists at this address", {
			details: { mint },
		});
	}
	return parseMint(mint, account);
}

export type MintLookup = (mint: Address) => Promise<MintDetails>;

export type MintCacheOptions = {
	/** How long a reading stays fresh. Decimals never change, but supply and authorities do. */
	ttlMs?: number;
	/** How many mints to remember, so a machine trading many tokens cannot grow memory without limit. */
	max?: number;
	now?: () => number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX = 500;

/**
 * A mint lookup that remembers what it read.
 *
 * Every run reads the same two or three mints, and each read is a network call on the path to a trade.
 * The cache is small, bounded and short lived: stale authority information is worse than a slow lookup,
 * so nothing is kept for long.
 */
export function cachedMints(reader: AccountReader, options: MintCacheOptions = {}): MintLookup {
	const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
	const max = options.max ?? DEFAULT_MAX;
	const now = options.now ?? Date.now;
	const entries = new Map<Address, { details: MintDetails; readAt: number }>();

	return async (mint: Address) => {
		const cached = entries.get(mint);
		if (cached && now() - cached.readAt < ttlMs) {
			// Refresh its place in insertion order, so the least used entry is the one dropped.
			entries.delete(mint);
			entries.set(mint, cached);
			return cached.details;
		}

		const details = await readMint(reader, mint);
		entries.delete(mint);
		entries.set(mint, { details, readAt: now() });
		if (entries.size > max) {
			const oldest = entries.keys().next();
			if (!oldest.done) entries.delete(oldest.value);
		}
		return details;
	};
}
