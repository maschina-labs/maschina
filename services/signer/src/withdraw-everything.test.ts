import { eventPayload, type WithdrawEverythingRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import {
	buildTokenWithdrawal,
	parseAddress,
	TOKEN_PROGRAM,
	tokenAccountFor,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { type WithdrawEverythingPorts, withdrawEverything } from "./withdraw-everything.ts";

const TRADING = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const VAULT = parseAddress("CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt");
const OWNER = parseAddress("G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu");
const STRANGER = parseAddress("H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const request: WithdrawEverythingRequest = {
	withdrawalId: newId<"withdrawal">(),
	machineId: newId<"machine">(),
};

const usdcIn = async (owner: string, amount: bigint, frozen = false) => ({
	account: parseAddress(await tokenAccountFor({ owner, mint: USDC })),
	mint: USDC,
	amount,
	decimals: 6,
	program: TOKEN_PROGRAM,
	frozen,
});

type Written = { type: string; payload: Record<string, unknown> };

async function ports(overrides: Partial<WithdrawEverythingPorts> = {}) {
	const written: Written[] = [];
	const signed: { account: string; bytes: Uint8Array }[] = [];
	const sent: Uint8Array[] = [];
	const solAsked: bigint[] = [];
	const holdings = new Map<string, Awaited<ReturnType<typeof usdcIn>>[]>([
		[VAULT, [await usdcIn(VAULT, 1_500_000n)]],
		[TRADING, [await usdcIn(TRADING, 10_000_000n)]],
	]);
	let next = 0;
	const base: WithdrawEverythingPorts = {
		machineFor: async () => ({
			wallet: TRADING,
			vault: VAULT,
			ownerWallet: OWNER,
			providerWalletId: "wallet-9f2c",
		}),
		tokensOf: async (account) => holdings.get(account) ?? [],
		lamportsOf: async () => 20_000_000n,
		latestBlockhash: async () => ({
			blockhash: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
			lastValidBlockHeight: 426_070_577n,
		}),
		record: async (event) => {
			// Parsed with the real schema, because the record will.
			eventPayload(event.type).parse(event.payload);
			written.push(event as Written);
		},
		submissionFor: async () => undefined,
		sign: async (_walletId, bytes, account) => {
			signed.push({ account, bytes });
			return bytes;
		},
		signatureOf: () => `${"5".repeat(87)}${next}`,
		send: async (bytes) => {
			sent.push(bytes);
		},
		confirm: async () => ({ outcome: "landed", signature: "5".repeat(88), slot: 426_070_000n }),
		costOf: async () => 5_000n,
		newId: () => {
			next += 1;
			return newId<"withdrawal">();
		},
		withdrawSol: async (asked) => {
			solAsked.push(BigInt(asked.lamports));
			return {
				status: "sent",
				withdrawalId: asked.withdrawalId,
				signature: "4".repeat(88),
				to: OWNER,
				lamports: asked.lamports,
			};
		},
		...overrides,
	};
	return { ports: base, written, signed, sent, solAsked };
}

const types = (written: Written[]) => written.map((event) => event.type);

describe("taking everything out of a machine", () => {
	it("empties the vault, then the trading account, then sends the SOL, and says what went home", async () => {
		const { ports: p, solAsked } = await ports();
		const answer = await withdrawEverything(p, request);

		expect(answer).toMatchObject({ status: "sent", withdrawalId: request.withdrawalId, to: OWNER });
		if (answer.status !== "sent") return;
		expect(answer.tokens).toEqual([
			{ mint: USDC, amount: "1500000", from: "vault" },
			{ mint: USDC, amount: "10000000", from: "trading" },
		]);
		expect(solAsked).toHaveLength(1);
		expect(answer.leftBehind).toEqual([]);
	});

	it("has the vault sign only for its own tokens, with the trading account paying", async () => {
		const { ports: p, signed } = await ports();
		await withdrawEverything(p, request);

		expect(signed.map((s) => s.account)).toEqual(["trading", "vault", "trading"]);
	});

	it("writes down which tokens are going home before it signs anything", async () => {
		const { ports: p, written } = await ports();
		await withdrawEverything(p, request);

		expect(types(written)).toEqual([
			"withdrawal.requested",
			"withdrawal.submitted",
			"withdrawal.completed",
			"withdrawal.requested",
			"withdrawal.submitted",
			"withdrawal.completed",
		]);
		expect(written[0]?.payload).toMatchObject({
			to: OWNER,
			lamports: "0",
			tokens: [{ mint: USDC, amount: "1500000", from: "vault" }],
		});
	});

	it("sends every lamport but the one fee the last transfer costs", async () => {
		const { ports: p, solAsked } = await ports({ lamportsOf: async () => 20_000_000n });
		await withdrawEverything(p, request);

		expect(solAsked).toEqual([19_995_000n]);
	});

	it("sends no SOL when there is not enough left to pay for sending it", async () => {
		const { ports: p, solAsked } = await ports({ lamportsOf: async () => 5_000n });
		await withdrawEverything(p, request);

		expect(solAsked).toEqual([]);
	});

	it("skips an account with nothing in it, rather than paying to send nothing", async () => {
		const { ports: p, signed } = await ports({
			tokensOf: async (account) => (account === VAULT ? [] : [await usdcIn(TRADING, 1n)]),
		});
		await withdrawEverything(p, request);

		expect(signed.map((s) => s.account)).toEqual(["trading"]);
	});

	it("empties a machine made before vaults, which has only its trading account", async () => {
		const { ports: p } = await ports({
			machineFor: async () => ({ wallet: TRADING, ownerWallet: OWNER, providerWalletId: "w" }),
		});
		const answer = await withdrawEverything(p, request);

		expect(answer.status === "sent" && answer.tokens.map((t) => t.from)).toEqual(["trading"]);
	});

	it("says what it had to leave behind, never leaving it behind quietly", async () => {
		const frozen = await usdcIn(TRADING, 2_000_000n, true);
		const { ports: p } = await ports({
			tokensOf: async (account) => (account === TRADING ? [frozen] : []),
		});
		const answer = await withdrawEverything(p, request);

		expect(answer.status === "sent" && answer.leftBehind).toEqual([
			{ mint: USDC, amount: "2000000", from: "trading", because: "frozen by the token's issuer" },
		]);
	});
});

describe("what it refuses", () => {
	it("a machine that does not exist", async () => {
		const { ports: p } = await ports({ machineFor: async () => undefined });
		expect(await withdrawEverything(p, request)).toMatchObject({
			status: "refused",
			rule: "unknown_machine",
		});
	});

	it("bytes that pay anybody but the owner, and writes down that it did", async () => {
		const {
			ports: p,
			written,
			sent,
		} = await ports({
			build: (asked) => buildTokenWithdrawal({ ...asked, owner: STRANGER }),
		});

		expect(await withdrawEverything(p, request)).toMatchObject({
			status: "refused",
			rule: "bad_transaction",
		});
		expect(types(written)).toEqual(["withdrawal.requested", "withdrawal.failed"]);
		expect(sent).toEqual([]);
	});

	it("says the chain has not answered rather than that it failed", async () => {
		const { ports: p } = await ports({
			confirm: async () => ({
				outcome: "unknown",
				signature: "5".repeat(88),
				because: "no answer",
			}),
		});
		await expect(withdrawEverything(p, request)).rejects.toThrow(/not answered/);
	});
});
