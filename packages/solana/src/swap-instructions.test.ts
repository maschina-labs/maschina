import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { REAL_JUPITER_BUY, REAL_JUPITER_SELL } from "./jupiter-swaps.fixture.ts";
import { checkSwapInstructions } from "./swap-instructions.ts";
import { type TestInstruction, transactionWith } from "./testing.ts";

/** The wallet the real Jupiter swaps were built for. */
const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
/** Its own wrapped SOL and USDC accounts, worked out independently in Rust. */
const OWN_WRAPPED_SOL = "CfZaYTfQ7YyeWv8XvcZ7amMAAcE83DLL2mNeef46Dvp7";
const OWN_USDC = "2arVPHhzahANuftuDyHXP414ye2ARUgJvcbP9NHAsfnj";
const STRANGER = "H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E";
const STRANGERS_ACCOUNT = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

const SYSTEM = "11111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";

const bytes = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));
const check = (instructions: TestInstruction[]) =>
	checkSwapInstructions(transactionWith(WALLET, instructions), WALLET);

/** Instruction data laid out from each program's specification: a discriminator, then the fields. */
const systemTransfer = (lamports: bigint) => {
	const data = new Uint8Array(12);
	new DataView(data.buffer).setUint32(0, 2, true);
	new DataView(data.buffer).setBigUint64(4, lamports, true);
	return data;
};
const tokenAmount = (discriminator: number, amount: bigint, decimals?: number) => {
	const data = new Uint8Array(decimals === undefined ? 9 : 10);
	data[0] = discriminator;
	new DataView(data.buffer).setBigUint64(1, amount, true);
	if (decimals !== undefined) data[9] = decimals;
	return data;
};

const me = { address: WALLET, signer: true, writable: true };
const acct = (address: string) => ({ address, writable: true });

describe("a real swap", () => {
	it("passes when it sells SOL, wrapping it into the wallet's own account first", async () => {
		await expect(checkSwapInstructions(bytes(REAL_JUPITER_SELL), WALLET)).resolves.toBeUndefined();
	});

	it("passes when it buys SOL", async () => {
		await expect(checkSwapInstructions(bytes(REAL_JUPITER_BUY), WALLET)).resolves.toBeUndefined();
	});

	it("is refused when checked against a wallet it was not built for", async () => {
		// The wrap, the close and the account creation all name the wallet the route was built for.
		await expect(
			checkSwapInstructions(bytes(REAL_JUPITER_SELL), parseAddress(STRANGER)),
		).rejects.toThrow();
	});
});

describe("moving tokens straight out", () => {
	it.each([
		["a transfer", tokenAmount(3, 50_000_000n)],
		["a checked transfer", tokenAmount(12, 50_000_000n, 6)],
	])(
		"refuses %s out of the wallet's own account, which is the hole in #667",
		async (_what, data) => {
			await expect(
				check([
					{
						program: TOKEN,
						accounts: [acct(OWN_USDC), acct(STRANGERS_ACCOUNT), me],
						data,
					},
				]),
			).rejects.toThrow(/token/i);
		},
	);

	it("refuses the same under the newer token program", async () => {
		await expect(
			check([
				{
					program: TOKEN_2022,
					accounts: [acct(OWN_USDC), { address: USDC }, acct(STRANGERS_ACCOUNT), me],
					data: tokenAmount(12, 50_000_000n, 6),
				},
			]),
		).rejects.toThrow(/token/i);
	});

	it("refuses handing somebody else the power to move them later", async () => {
		await expect(
			check([
				{
					program: TOKEN,
					accounts: [acct(OWN_USDC), { address: STRANGER }, me],
					data: tokenAmount(4, 50_000_000n),
				},
			]),
		).rejects.toThrow(/token/i);
	});

	it("refuses handing over the account itself", async () => {
		const data = new Uint8Array(35);
		data[0] = 6;
		await expect(check([{ program: TOKEN, accounts: [acct(OWN_USDC), me], data }])).rejects.toThrow(
			/token/i,
		);
	});

	it("refuses closing an account and sending what is in it to somebody else", async () => {
		// Closing a wrapped SOL account pays out every lamport in it. To anyone but the wallet, that is
		// a transfer of SOL wearing a token instruction's clothes.
		await expect(
			check([
				{
					program: TOKEN,
					accounts: [acct(OWN_WRAPPED_SOL), acct(STRANGER), me],
					data: new Uint8Array([9]),
				},
			]),
		).rejects.toThrow(/close/i);
	});

	it("allows closing an account back into the wallet, which every swap does", async () => {
		await expect(
			check([
				{
					program: TOKEN,
					accounts: [acct(OWN_WRAPPED_SOL), me, me],
					data: new Uint8Array([9]),
				},
			]),
		).resolves.toBeUndefined();
	});
});

describe("moving SOL", () => {
	it("allows wrapping into the wallet's own account", async () => {
		await expect(
			check([
				{
					program: SYSTEM,
					accounts: [me, acct(OWN_WRAPPED_SOL)],
					data: systemTransfer(10_000_000n),
				},
				{ program: TOKEN, accounts: [acct(OWN_WRAPPED_SOL)], data: new Uint8Array([17]) },
			]),
		).resolves.toBeUndefined();
	});

	it("refuses sending it to anybody else", async () => {
		await expect(
			check([
				{ program: SYSTEM, accounts: [me, acct(STRANGER)], data: systemTransfer(10_000_000n) },
			]),
		).rejects.toThrow(/SOL/);
	});

	it("refuses funding a new account, which moves SOL without being called a transfer", async () => {
		const data = new Uint8Array(52);
		new DataView(data.buffer).setUint32(0, 0, true);
		await expect(
			check([
				{
					program: SYSTEM,
					accounts: [me, { address: STRANGER, signer: true, writable: true }],
					data,
				},
			]),
		).rejects.toThrow(/system/i);
	});
});

describe("making the account a swap receives into", () => {
	it("allows making the wallet's own, paid for by the wallet", async () => {
		await expect(
			check([
				{
					program: ASSOCIATED,
					accounts: [
						me,
						acct(OWN_WRAPPED_SOL),
						{ address: WALLET },
						{ address: WSOL },
						{ address: SYSTEM },
						{ address: TOKEN },
					],
					data: new Uint8Array([1]),
				},
			]),
		).resolves.toBeUndefined();
	});

	it("refuses making one for somebody else at the wallet's expense", async () => {
		await expect(
			check([
				{
					program: ASSOCIATED,
					accounts: [
						me,
						acct(STRANGERS_ACCOUNT),
						{ address: STRANGER },
						{ address: WSOL },
						{ address: SYSTEM },
						{ address: TOKEN },
					],
					data: new Uint8Array([1]),
				},
			]),
		).rejects.toThrow(/account/i);
	});
});
