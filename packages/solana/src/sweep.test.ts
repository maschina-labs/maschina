import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { buildSweep, checkUnsignedSweep, type SweepRequest } from "./sweep.ts";
import { transactionWith } from "./testing.ts";
import { tokenAccountFor } from "./token-account.ts";

const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const VAULT = parseAddress("8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk");
const STRANGER = parseAddress("H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const request = (over: Partial<SweepRequest> = {}): SweepRequest => ({
	wallet: WALLET,
	vault: VAULT,
	mint: USDC,
	decimals: 6,
	amount: 1_500_000n,
	blockhash: "11111111111111111111111111111111",
	lastValidBlockHeight: 426_070_577n,
	...over,
});

const expected = { wallet: WALLET, vault: VAULT, mint: USDC, amount: 1_500_000n };

describe("building a sweep", () => {
	it("builds something the check accepts: into the vault's account, from the machine's, for the amount", async () => {
		const bytes = await buildSweep(request());

		await expect(checkUnsignedSweep(bytes, expected)).resolves.toMatchObject({
			instructionCount: 2,
		});
	});

	it("refuses to sweep nothing", async () => {
		await expect(buildSweep(request({ amount: 0n }))).rejects.toThrow(/nothing/);
	});

	it("refuses to sweep into the machine itself", async () => {
		await expect(buildSweep(request({ vault: WALLET }))).rejects.toThrow(/vault/);
	});
});

describe("checking a sweep's bytes", () => {
	it("refuses a sweep for a different amount than was decided", async () => {
		const bytes = await buildSweep(request({ amount: 2_000_000n }));
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/amount/);
	});

	it("refuses a sweep into anybody's account but the vault's", async () => {
		const bytes = await buildSweep(request({ vault: STRANGER }));
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/vault/);
	});

	it("refuses a sweep of a different token", async () => {
		const bytes = await buildSweep(
			request({ mint: parseAddress("So11111111111111111111111111111111111111112"), decimals: 9 }),
		);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow();
	});

	it("refuses anything that is not a checked transfer, since the provider only sees a mint on one", async () => {
		const data = new Uint8Array(9);
		data[0] = 3;
		new DataView(data.buffer).setBigUint64(1, 1_500_000n, true);
		const bytes = transactionWith(WALLET, [
			{
				program: TOKEN,
				accounts: [
					{ address: await tokenAccountFor({ owner: WALLET, mint: USDC }), writable: true },
					{ address: await tokenAccountFor({ owner: VAULT, mint: USDC }), writable: true },
					{ address: WALLET, signer: true, writable: true },
				],
				data,
			},
		]);

		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/checked transfer/);
	});

	it("refuses a sweep that also moves SOL", async () => {
		const bytes = await buildSweep(request());
		const data = new Uint8Array(12);
		new DataView(data.buffer).setUint32(0, 2, true);
		new DataView(data.buffer).setBigUint64(4, 1_000_000n, true);
		const extra = transactionWith(WALLET, [
			{
				program: "11111111111111111111111111111111",
				accounts: [
					{ address: WALLET, signer: true, writable: true },
					{ address: STRANGER, writable: true },
				],
				data,
			},
		]);

		expect(bytes.length).toBeGreaterThan(0);
		await expect(checkUnsignedSweep(extra, expected)).rejects.toThrow(/program/);
	});

	it("refuses a sweep with two transfers in it", async () => {
		const one = (await tokenAccountFor({ owner: WALLET, mint: USDC })) as string;
		const vaultAccount = (await tokenAccountFor({ owner: VAULT, mint: USDC })) as string;
		const checked = new Uint8Array(10);
		checked[0] = 12;
		new DataView(checked.buffer).setBigUint64(1, 1_500_000n, true);
		checked[9] = 6;
		const transfer = {
			program: TOKEN,
			accounts: [
				{ address: one, writable: true },
				{ address: USDC },
				{ address: vaultAccount, writable: true },
				{ address: WALLET, signer: true, writable: true },
			],
			data: checked,
		};

		await expect(
			checkUnsignedSweep(transactionWith(WALLET, [transfer, transfer]), expected),
		).rejects.toThrow(/exactly one/);
	});
});

describe("every other way a sweep's bytes can be wrong", () => {
	const checkedData = (amount: bigint) => {
		const data = new Uint8Array(10);
		data[0] = 12;
		new DataView(data.buffer).setBigUint64(1, amount, true);
		data[9] = 6;
		return data;
	};
	const transferFrom = async (source: string, authority: string, mint: string = USDC) =>
		transactionWith(WALLET, [
			{
				program: TOKEN,
				accounts: [
					{ address: source, writable: true },
					{ address: mint },
					{ address: await tokenAccountFor({ owner: VAULT, mint: USDC }), writable: true },
					{ address: authority, signer: authority === WALLET, writable: authority === WALLET },
				],
				data: checkedData(1_500_000n),
			},
		]);

	it("refuses tokens taken from an account that is not the machine's", async () => {
		const bytes = await transferFrom(
			await tokenAccountFor({ owner: STRANGER, mint: USDC }),
			WALLET,
		);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/not the machine's/);
	});

	it("refuses a transfer that names a different token than the one decided", async () => {
		const bytes = await transferFrom(
			await tokenAccountFor({ owner: WALLET, mint: USDC }),
			WALLET,
			"So11111111111111111111111111111111111111112",
		);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/other than the one decided/);
	});

	it("refuses a token program that is not a token program", async () => {
		const bytes = await buildSweep(request());
		await expect(
			checkUnsignedSweep(bytes, { ...expected, tokenProgram: "11111111111111111111111111111111" }),
		).rejects.toThrow();
	});

	it("refuses an account made for anybody but the vault", async () => {
		const bytes = transactionWith(WALLET, [
			{
				program: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
				accounts: [
					{ address: WALLET, signer: true, writable: true },
					{ address: await tokenAccountFor({ owner: STRANGER, mint: USDC }), writable: true },
					{ address: STRANGER },
					{ address: USDC },
				],
				data: new Uint8Array([1]),
			},
		]);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/not the vault's/);
	});

	it("refuses any associated token instruction but making the vault's account", async () => {
		const bytes = transactionWith(WALLET, [
			{
				program: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
				accounts: [{ address: WALLET, signer: true, writable: true }],
				data: new Uint8Array([2]),
			},
		]);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/only ever makes/);
	});

	it("refuses bytes with no transfer in them at all", async () => {
		const bytes = transactionWith(WALLET, []);
		await expect(checkUnsignedSweep(bytes, expected)).rejects.toThrow(/exactly one/);
	});
});
