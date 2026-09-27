import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { transactionWith } from "./testing.ts";
import { TOKEN_PROGRAM, tokenAccountFor } from "./token-account.ts";
import {
	buildTokenWithdrawal,
	checkUnsignedTokenWithdrawal,
	type TokenWithdrawal,
} from "./token-withdrawal.ts";

const TRADING = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const VAULT = parseAddress("CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt");
const OWNER = parseAddress("G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu");
const STRANGER = parseAddress("H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const WSOL = parseAddress("So11111111111111111111111111111111111111112");

const usdcOf = async (owner: string) => parseAddress(await tokenAccountFor({ owner, mint: USDC }));

async function withdrawal(over: Partial<TokenWithdrawal> = {}): Promise<TokenWithdrawal> {
	return {
		payer: TRADING,
		from: VAULT,
		owner: OWNER,
		tokens: [
			{
				account: await usdcOf(VAULT),
				mint: USDC,
				amount: 1_500_000n,
				decimals: 6,
				program: TOKEN_PROGRAM,
			},
		],
		blockhash: "11111111111111111111111111111111",
		lastValidBlockHeight: 426_070_577n,
		...over,
	};
}

describe("sending a machine's tokens home", () => {
	it("builds what the check accepts: every token to the owner, every account closed to the owner", async () => {
		const asked = await withdrawal();
		const bytes = await buildTokenWithdrawal(asked);

		await expect(checkUnsignedTokenWithdrawal(bytes, asked)).resolves.toMatchObject({
			// Make the owner's account, move the tokens, close the empty account.
			instructionCount: 3,
		});
	});

	it("needs the vault's signature as well as the payer's when it empties the vault", async () => {
		const bytes = await buildTokenWithdrawal(await withdrawal());
		const facts = await checkUnsignedTokenWithdrawal(bytes, await withdrawal());

		expect(facts.signers.sort()).toEqual([TRADING, VAULT].sort());
	});

	it("needs one signature when it empties the account that pays", async () => {
		const asked = await withdrawal({
			from: TRADING,
			tokens: [
				{
					account: await usdcOf(TRADING),
					mint: USDC,
					amount: 9n,
					decimals: 6,
					program: TOKEN_PROGRAM,
				},
			],
		});
		const facts = await checkUnsignedTokenWithdrawal(await buildTokenWithdrawal(asked), asked);

		expect(facts.signers).toEqual([TRADING]);
	});

	it("closes wrapped SOL rather than moving it, so it arrives as SOL", async () => {
		const wrapped = parseAddress(await tokenAccountFor({ owner: TRADING, mint: WSOL }));
		const asked = await withdrawal({
			from: TRADING,
			tokens: [
				{ account: wrapped, mint: WSOL, amount: 50_000_000n, decimals: 9, program: TOKEN_PROGRAM },
			],
		});
		const facts = await checkUnsignedTokenWithdrawal(await buildTokenWithdrawal(asked), asked);

		expect(facts.instructionCount).toBe(1);
	});

	it("closes an empty account too, because its rent is the owner's money", async () => {
		const asked = await withdrawal({
			tokens: [
				{
					account: await usdcOf(VAULT),
					mint: USDC,
					amount: 0n,
					decimals: 6,
					program: TOKEN_PROGRAM,
				},
			],
		});
		const facts = await checkUnsignedTokenWithdrawal(await buildTokenWithdrawal(asked), asked);

		expect(facts.instructionCount).toBe(1);
	});

	it("refuses to build anything that pays somebody other than the owner", async () => {
		await expect(buildTokenWithdrawal(await withdrawal({ owner: VAULT }))).rejects.toThrow(/owner/);
	});
});

describe("checking what was built", () => {
	it("refuses tokens sent to anybody but the owner", async () => {
		const bytes = await buildTokenWithdrawal(await withdrawal({ owner: STRANGER }));
		await expect(checkUnsignedTokenWithdrawal(bytes, await withdrawal())).rejects.toThrow(/owner/);
	});

	it("refuses an amount other than the whole balance that was read", async () => {
		const bytes = await buildTokenWithdrawal(await withdrawal());
		const expected = await withdrawal();
		const differs = {
			...expected,
			tokens: expected.tokens.map((t) => ({ ...t, amount: 1_000_000n })),
		};

		await expect(checkUnsignedTokenWithdrawal(bytes, differs)).rejects.toThrow(/amount/);
	});

	it("refuses a token account that was not read, so nothing is taken from somewhere unexpected", async () => {
		const bytes = await buildTokenWithdrawal(await withdrawal());
		const expected = await withdrawal({ tokens: [] });

		await expect(checkUnsignedTokenWithdrawal(bytes, expected)).rejects.toThrow();
	});

	it("refuses SOL moving anywhere in a token withdrawal", async () => {
		const data = new Uint8Array(12);
		new DataView(data.buffer).setUint32(0, 2, true);
		new DataView(data.buffer).setBigUint64(4, 1_000_000n, true);
		const bytes = transactionWith(TRADING, [
			{
				program: "11111111111111111111111111111111",
				accounts: [
					{ address: TRADING, signer: true, writable: true },
					{ address: STRANGER, writable: true },
				],
				data,
			},
		]);

		await expect(
			checkUnsignedTokenWithdrawal(bytes, await withdrawal({ from: TRADING, tokens: [] })),
		).rejects.toThrow(/program/);
	});

	it("refuses an account closed into anybody but the owner", async () => {
		const account = await usdcOf(VAULT);
		const bytes = transactionWith(TRADING, [
			{
				program: TOKEN_PROGRAM,
				accounts: [
					{ address: account, writable: true },
					{ address: STRANGER, writable: true },
					{ address: VAULT, signer: true },
				],
				data: new Uint8Array([9]),
			},
		]);
		const expected = await withdrawal({
			tokens: [{ account, mint: USDC, amount: 0n, decimals: 6, program: TOKEN_PROGRAM }],
		});

		await expect(checkUnsignedTokenWithdrawal(bytes, expected)).rejects.toThrow(/close/);
	});
});

describe("every other way a token withdrawal can be wrong", () => {
	const checked = (amount: bigint, decimals = 6) => {
		const data = new Uint8Array(10);
		data[0] = 12;
		new DataView(data.buffer).setBigUint64(1, amount, true);
		data[9] = decimals;
		return data;
	};
	const account = () => usdcOf(VAULT);
	const expected = async (amount = 1_500_000n) =>
		withdrawal({
			tokens: [
				{ account: await account(), mint: USDC, amount, decimals: 6, program: TOKEN_PROGRAM },
			],
		});
	const transfer = async (to?: string) => ({
		program: TOKEN_PROGRAM,
		accounts: [
			{ address: await account(), writable: true },
			{ address: USDC },
			{ address: to ?? (await usdcOf(OWNER)), writable: true },
			{ address: VAULT, signer: true },
		],
		data: checked(1_500_000n),
	});
	const close = async () => ({
		program: TOKEN_PROGRAM,
		accounts: [
			{ address: await account(), writable: true },
			{ address: OWNER, writable: true },
			{ address: VAULT, signer: true },
		],
		data: new Uint8Array([9]),
	});

	it("refuses bytes that are not a transaction", async () => {
		await expect(
			checkUnsignedTokenWithdrawal(new Uint8Array([1, 2, 3]), await expected()),
		).rejects.toThrow(/could not be read/);
	});

	it("refuses a withdrawal that leaves an account open", async () => {
		const bytes = transactionWith(TRADING, [await transfer()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(/open/);
	});

	it("refuses a withdrawal that closes an account it never emptied", async () => {
		const bytes = transactionWith(TRADING, [await close()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/balance behind/,
		);
	});

	it("refuses the same account moved twice", async () => {
		const bytes = transactionWith(TRADING, [await transfer(), await transfer(), await close()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(/twice/);
	});

	it("refuses tokens moved with anything but a checked transfer", async () => {
		const plain = new Uint8Array(9);
		plain[0] = 3;
		const bytes = transactionWith(TRADING, [{ ...(await transfer()), data: plain }, await close()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/checked transfer/,
		);
	});

	it("refuses tokens paid into somebody else's account", async () => {
		const bytes = transactionWith(TRADING, [await transfer(await usdcOf(STRANGER)), await close()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/owner's own account/,
		);
	});

	it("refuses an account of the right address under the wrong token program", async () => {
		const bytes = transactionWith(TRADING, [
			{ ...(await close()), program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" },
		]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected(0n))).rejects.toThrow(
			/wrong token program/,
		);
	});

	it("refuses an account made for somebody other than the owner", async () => {
		const bytes = transactionWith(TRADING, [
			{
				program: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
				accounts: [
					{ address: TRADING, signer: true, writable: true },
					{ address: await usdcOf(STRANGER), writable: true },
					{ address: STRANGER },
					{ address: USDC },
				],
				data: new Uint8Array([1]),
			},
		]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/other than the owner/,
		);
	});

	it("refuses any associated token instruction but making an account", async () => {
		const bytes = transactionWith(TRADING, [
			{
				program: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
				accounts: [{ address: TRADING, signer: true, writable: true }],
				data: new Uint8Array([2]),
			},
		]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/only makes/,
		);
	});

	it("refuses a withdrawal somebody else pays for", async () => {
		const bytes = transactionWith(VAULT, [await transfer(), await close()]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/somebody else to sign|not paying/,
		);
	});

	it("refuses a withdrawal that asks a third account to sign", async () => {
		const bytes = transactionWith(TRADING, [
			await transfer(),
			{
				...(await close()),
				accounts: [...(await close()).accounts, { address: STRANGER, signer: true }],
			},
		]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).rejects.toThrow(
			/somebody else to sign/,
		);
	});

	it("allows a compute budget instruction, which moves nothing", async () => {
		const limit = new Uint8Array(5);
		limit[0] = 2;
		const bytes = transactionWith(TRADING, [
			{ program: "ComputeBudget111111111111111111111111111111", data: limit },
			await transfer(),
			await close(),
		]);
		await expect(checkUnsignedTokenWithdrawal(bytes, await expected())).resolves.toBeDefined();
	});
});
