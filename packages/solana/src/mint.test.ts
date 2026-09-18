import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import {
	type AccountReader,
	cachedMints,
	type FetchedAccount,
	parseMint,
	readMint,
} from "./mint.ts";

const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SOL = parseAddress("So11111111111111111111111111111111111111112");
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/** A mint account shaped the way an RPC returns it, with fields overridden per test. */
const mintAccount = (
	info: Record<string, unknown> = {},
	options: { owner?: string; type?: string } = {},
): FetchedAccount => ({
	owner: options.owner ?? TOKEN_PROGRAM,
	data: {
		parsed: {
			type: options.type ?? "mint",
			info: {
				decimals: 6,
				freezeAuthority: null,
				isInitialized: true,
				mintAuthority: null,
				supply: "7659247483949918",
				...info,
			},
		},
		program: "spl-token",
		space: 82,
	},
});

describe("reading a mint", () => {
	it("reads the numbers that decide what an amount means", () => {
		const details = parseMint(USDC, mintAccount());

		expect(details.decimals).toBe(6);
		expect(details.supply).toBe(7_659_247_483_949_918n);
		expect(details.program).toBe("token");
		expect(details.mint).toBe(USDC);
	});

	it("reports the authorities that make a token dangerous", () => {
		const details = parseMint(USDC, mintAccount({ freezeAuthority: SOL, mintAuthority: SOL }));

		expect(details.freezeAuthority).toBe(SOL);
		expect(details.mintAuthority).toBe(SOL);
	});

	it("leaves the authorities out when nobody holds them", () => {
		const details = parseMint(SOL, mintAccount({ decimals: 9, supply: "0" }));

		expect(details.freezeAuthority).toBeUndefined();
		expect(details.mintAuthority).toBeUndefined();
		expect(details.extensions).toEqual([]);
	});

	it("reads Token-2022 extensions by name", () => {
		const details = parseMint(
			USDC,
			mintAccount(
				{
					extensions: [
						{ extension: "transferFeeConfig", state: {} },
						{ extension: "permanentDelegate" },
						{ notAnExtension: true },
						"nonsense",
					],
				},
				{ owner: TOKEN_2022 },
			),
		);

		expect(details.program).toBe("token-2022");
		expect(details.extensions).toEqual(["transferFeeConfig", "permanentDelegate"]);
	});

	it("refuses an account owned by anything but a token program", () => {
		expect(() =>
			parseMint(USDC, mintAccount({}, { owner: "11111111111111111111111111111111" })),
		).toThrow(/not a token mint/);
	});

	it("refuses a token account, which is not a mint", () => {
		expect(() => parseMint(USDC, mintAccount({}, { type: "account" }))).toThrow(/not a mint/);
	});

	it("refuses an uninitialised mint", () => {
		expect(() => parseMint(USDC, mintAccount({ isInitialized: false }))).toThrow(/not initialised/);
	});

	it.each([
		["a missing data shape", { owner: TOKEN_PROGRAM, data: "base64 nonsense" }],
		[
			"details that are not an object",
			{ owner: TOKEN_PROGRAM, data: { parsed: { type: "mint", info: "nope" } } },
		],
	])("refuses %s", (_name, account) => {
		expect(() => parseMint(USDC, account as FetchedAccount)).toThrow(MaschinaError);
	});

	it.each([
		["decimals that are not whole", { decimals: 6.5 }],
		["decimals that are text", { decimals: "6" }],
		["decimals beyond what the arithmetic supports", { decimals: 19 }],
		["negative decimals", { decimals: -1 }],
		["a supply that is not a number", { supply: "many" }],
		["a supply held as a number", { supply: 12 }],
		["an authority that is not an address", { mintAuthority: 42 }],
		["an authority that is not a real address", { freezeAuthority: "not-an-address" }],
	])("refuses %s", (_name, info) => {
		expect(() => parseMint(USDC, mintAccount(info))).toThrow(MaschinaError);
	});
});

/** A reader that counts how often the chain was actually asked. */
function countingReader(accounts: Record<string, FetchedAccount>) {
	let reads = 0;
	const reader: AccountReader = {
		async read(address) {
			reads += 1;
			return accounts[address];
		},
	};
	return {
		reader,
		get reads() {
			return reads;
		},
	};
}

describe("looking a mint up", () => {
	it("says so when nothing exists at the address", async () => {
		const { reader } = countingReader({});

		await expect(readMint(reader, USDC)).rejects.toThrow(/no account exists/);
	});

	it("asks the chain once and remembers the answer", async () => {
		const counting = countingReader({ [USDC]: mintAccount() });
		const lookup = cachedMints(counting.reader);

		expect((await lookup(USDC)).decimals).toBe(6);
		expect((await lookup(USDC)).decimals).toBe(6);
		expect(counting.reads).toBe(1);
	});

	it("asks again once the answer is stale, because authorities change", async () => {
		const counting = countingReader({ [USDC]: mintAccount() });
		let clock = 0;
		const lookup = cachedMints(counting.reader, { ttlMs: 1000, now: () => clock });

		await lookup(USDC);
		clock = 999;
		await lookup(USDC);
		expect(counting.reads).toBe(1);

		clock = 1000;
		await lookup(USDC);
		expect(counting.reads).toBe(2);
	});

	it("forgets the least recently used mint rather than growing forever", async () => {
		const counting = countingReader({ [USDC]: mintAccount(), [SOL]: mintAccount({ decimals: 9 }) });
		const lookup = cachedMints(counting.reader, { max: 1 });

		await lookup(USDC);
		await lookup(SOL);
		await lookup(USDC);

		expect(counting.reads).toBe(3);
	});

	it("does not remember a failure", async () => {
		const counting = countingReader({});
		const lookup = cachedMints(counting.reader);

		await expect(lookup(USDC)).rejects.toThrow(MaschinaError);
		await expect(lookup(USDC)).rejects.toThrow(MaschinaError);
		expect(counting.reads).toBe(2);
	});
});
