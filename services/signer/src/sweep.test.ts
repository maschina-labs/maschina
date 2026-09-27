import { eventPayload, type SweepRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { sweepDue } from "@maschina/rules";
import { buildSweep, parseAddress } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { type SweepPorts, sweepProfit } from "./sweep.ts";

const MACHINE_WALLET = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";
const VAULT = "CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt";
const ELSEWHERE = "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Fifty dollars at six decimals. */
const FLOAT = 50_000_000n;

const request: SweepRequest = { sweepId: newId<"sweep">(), machineId: newId<"machine">() };

type Written = { type: string; payload: Record<string, unknown> };

/** The float as the record would give it, decided by the real rule rather than a stand-in. */
const floatAt = (holding: bigint, flat = true) => ({
	target: FLOAT,
	value: holding,
	sweep: sweepDue({ target: FLOAT, value: holding, flat }),
});

function ports(overrides: Partial<SweepPorts> = {}) {
	const written: Written[] = [];
	const sent: Uint8Array[] = [];
	const signed: Uint8Array[] = [];
	const base: SweepPorts = {
		machineFor: async () => ({
			wallet: parseAddress(MACHINE_WALLET),
			vault: parseAddress(VAULT),
			providerWalletId: "wallet-9f2c",
			budgetMint: parseAddress(USDC),
			paper: false,
		}),
		holdingOf: async () => FLOAT + 1_500_000n,
		floatOf: async (_machineId, holding) => floatAt(holding),
		decimalsOf: async () => 6,
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
		requestedFor: async () => undefined,
		sign: async (_walletId, transaction) => {
			signed.push(transaction);
			return transaction;
		},
		signatureOf: () => "5".repeat(88),
		send: async (transaction) => {
			sent.push(transaction);
		},
		confirm: async () => ({ outcome: "landed", signature: "5".repeat(88), slot: 426_070_000n }),
		costOf: async () => 5_000n,
		...overrides,
	};
	return { ports: base, written, sent, signed };
}

const types = (written: Written[]) => written.map((event) => event.type);

describe("banking a machine's profit", () => {
	it("moves exactly the surplus into the vault, and says where it went", async () => {
		const { ports: p, sent } = ports();

		expect(await sweepProfit(p, request)).toEqual({
			status: "swept",
			sweepId: request.sweepId,
			signature: "5".repeat(88),
			to: VAULT,
			mint: USDC,
			amount: "1500000",
		});
		expect(sent).toHaveLength(1);
	});

	it("writes down why before it signs anything, then the signature, then the outcome", async () => {
		const { ports: p, written } = ports();
		await sweepProfit(p, request);

		expect(types(written)).toEqual(["sweep.requested", "sweep.submitted", "sweep.completed"]);
		// The record answers "why was this swept", not only "what".
		expect(written[0]?.payload).toMatchObject({
			to: VAULT,
			amount: "1500000",
			value: "51500000",
			floatTarget: "50000000",
		});
		expect(written[2]?.payload).toMatchObject({ feeLamports: "5000", slot: "426070000" });
	});

	it("takes the amount from the float, never from anything it was handed", async () => {
		const { ports: p } = ports({ holdingOf: async () => FLOAT + 7_250_000n });
		expect(await sweepProfit(p, request)).toMatchObject({ amount: "7250000" });
	});
});

describe("when there is nothing to bank", () => {
	it.each([
		["below its float", FLOAT - 3_000_000n, true],
		["above it by less than a transaction is worth", FLOAT + 400_000n, true],
		["holding a position", FLOAT + 9_000_000n, false],
	])("says so for a machine %s, and writes and signs nothing", async (_what, holding, flat) => {
		const {
			ports: p,
			written,
			signed,
		} = ports({
			holdingOf: async () => holding,
			floatOf: async (_id, held) => floatAt(held, flat),
		});

		expect(await sweepProfit(p, request)).toMatchObject({ status: "not_due" });
		expect(written).toEqual([]);
		expect(signed).toEqual([]);
	});
});

describe("what it refuses", () => {
	it("a machine made before vaults, which has nowhere to bank", async () => {
		const { ports: p, written } = ports({
			machineFor: async () => ({
				wallet: parseAddress(MACHINE_WALLET),
				providerWalletId: "wallet-9f2c",
				budgetMint: parseAddress(USDC),
				paper: false,
			}),
		});

		expect(await sweepProfit(p, request)).toMatchObject({ status: "refused", rule: "no_vault" });
		expect(written).toEqual([]);
	});

	it("a machine on paper, whose profit is not money", async () => {
		const { ports: p, signed } = ports({
			machineFor: async () => ({
				wallet: parseAddress(MACHINE_WALLET),
				vault: parseAddress(VAULT),
				providerWalletId: "wallet-9f2c",
				budgetMint: parseAddress(USDC),
				paper: true,
			}),
		});

		expect(await sweepProfit(p, request)).toMatchObject({ status: "refused", rule: "paper" });
		expect(signed).toEqual([]);
	});

	it("a machine whose budget has no currency to measure a float in", async () => {
		const { ports: p } = ports({
			machineFor: async () => ({
				wallet: parseAddress(MACHINE_WALLET),
				vault: parseAddress(VAULT),
				providerWalletId: "wallet-9f2c",
				paper: false,
			}),
		});

		expect(await sweepProfit(p, request)).toMatchObject({ status: "refused", rule: "no_float" });
	});

	it("a machine that does not exist", async () => {
		const { ports: p } = ports({ machineFor: async () => undefined });
		expect(await sweepProfit(p, request)).toMatchObject({
			status: "refused",
			rule: "unknown_machine",
		});
	});

	it("bytes that pay anywhere but the vault, and writes down that it did", async () => {
		// Built by something that got the vault wrong. The check reads the bytes, not the intent.
		const {
			ports: p,
			written,
			sent,
		} = ports({
			build: (sweep) => buildSweep({ ...sweep, vault: parseAddress(ELSEWHERE) }),
		});

		expect(await sweepProfit(p, request)).toMatchObject({
			status: "refused",
			rule: "bad_transaction",
		});
		expect(types(written)).toEqual(["sweep.requested", "sweep.failed"]);
		expect(sent).toEqual([]);
	});
});

describe("sending once", () => {
	const alreadySent = {
		submissionFor: async () => ({
			signature: "5".repeat(88),
			lastValidBlockHeight: 426_070_577n,
		}),
		requestedFor: async () => ({
			to: parseAddress(VAULT),
			mint: parseAddress(USDC),
			amount: 1_500_000n,
		}),
	};

	it("never signs a second time for a sweep that already has a signature", async () => {
		const { ports: p, signed } = ports(alreadySent);
		await sweepProfit(p, request);

		expect(signed).toEqual([]);
	});

	it("finishes a sweep it already sent from what it decided then, not what it would decide now", async () => {
		// Asked again after the chain went quiet. If it landed, the account is back on its line and a
		// fresh look would say nothing is due, and the sweep would never be written down as banked.
		const { ports: p, written, signed } = ports({ ...alreadySent, holdingOf: async () => FLOAT });

		expect(await sweepProfit(p, request)).toMatchObject({ status: "swept", amount: "1500000" });
		expect(types(written)).toEqual(["sweep.completed"]);
		expect(written[0]?.payload).toMatchObject({ amount: "1500000", to: VAULT });
		expect(signed).toEqual([]);
	});

	it("refuses to finish a signature it has no decision for", async () => {
		const { ports: p } = ports({ ...alreadySent, requestedFor: async () => undefined });
		expect(await sweepProfit(p, request)).toMatchObject({
			status: "refused",
			rule: "unknown_sweep",
		});
	});

	it("writes a failure down when the chain refuses it", async () => {
		const { ports: p, written } = ports({
			confirm: async () => ({
				outcome: "failed",
				signature: "5".repeat(88),
				reason: "insufficient funds",
			}),
		});

		expect(await sweepProfit(p, request)).toMatchObject({ status: "refused", rule: "not_landed" });
		expect(types(written)).toContain("sweep.failed");
	});

	it("says the chain has not answered, and leaves the sweep open rather than failed", async () => {
		// It may still land. Writing it down as failed would let the next check sweep the same profit
		// again, and both could land.
		const { ports: p, written } = ports({
			confirm: async () => ({
				outcome: "unknown",
				signature: "5".repeat(88),
				because: "no answer yet",
			}),
		});

		await expect(sweepProfit(p, request)).rejects.toThrow(/not answered/);
		expect(types(written)).toEqual(["sweep.requested", "sweep.submitted"]);
	});
});
