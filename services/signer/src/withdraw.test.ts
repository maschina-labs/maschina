import { eventPayload, type WithdrawRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { buildTransfer, parseAddress } from "@maschina/solana";
import { describe, expect, it, vi } from "vitest";
import { type WithdrawPorts, withdrawFunds } from "./withdraw.ts";

const MACHINE_WALLET = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";
const OWNER_WALLET = "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu";
const ELSEWHERE = "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E";

const request: WithdrawRequest = {
	withdrawalId: newId<"withdrawal">(),
	machineId: newId<"machine">(),
	lamports: "250000000",
};

type Written = { type: string; payload: Record<string, unknown> };

function ports(overrides: Partial<WithdrawPorts> = {}) {
	const written: Written[] = [];
	const sent: Uint8Array[] = [];
	const base: WithdrawPorts = {
		machineFor: async () => ({
			wallet: parseAddress(MACHINE_WALLET),
			ownerWallet: parseAddress(OWNER_WALLET),
			providerWalletId: "wallet-9f2c",
		}),
		latestBlockhash: async () => ({
			blockhash: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
			lastValidBlockHeight: 426_070_577n,
		}),
		record: async (event) => {
			// Parsed with the real schema, because the record will. A payload the contract refuses is a
			// withdrawal that silently fails to be written down.
			eventPayload(event.type).parse(event.payload);
			written.push(event as Written);
		},
		submissionFor: async () => undefined,
		sign: async (_walletId, transaction) => transaction,
		signatureOf: () => "5".repeat(88),
		send: async (signed) => {
			sent.push(signed);
		},
		confirm: async () => ({ outcome: "landed", signature: "5".repeat(88), slot: 426_070_000n }),
		costOf: async () => 5_000n,
		...overrides,
	};
	return { ports: base, written, sent };
}

const types = (written: Written[]) => written.map((event) => event.type);

describe("withdrawing a machine's funds", () => {
	it("pays the owner, and says where it went", async () => {
		const { ports: p, sent } = ports();

		const answer = await withdrawFunds(p, request);

		expect(answer).toMatchObject({
			status: "sent",
			withdrawalId: request.withdrawalId,
			to: OWNER_WALLET,
			lamports: "250000000",
		});
		expect(sent).toHaveLength(1);
	});

	it("writes the request down before it signs anything", async () => {
		const { ports: p, written } = ports();

		await withdrawFunds(p, request);

		expect(types(written)).toEqual([
			"withdrawal.requested",
			"withdrawal.submitted",
			"withdrawal.completed",
		]);
		expect(written[0]?.payload).toMatchObject({ to: OWNER_WALLET, lamports: "250000000" });
	});

	it("records what it cost to send, because the owner paid it", async () => {
		const { ports: p, written } = ports();

		await withdrawFunds(p, request);

		expect(written[2]?.payload).toMatchObject({ feeLamports: "5000", slot: "426070000" });
	});

	it("refuses a machine nobody owns, without signing", async () => {
		const sign = vi.fn();
		const { ports: p, written } = ports({ machineFor: async () => undefined, sign });

		const answer = await withdrawFunds(p, request);

		expect(answer).toMatchObject({ status: "refused", rule: "unknown_machine" });
		expect(sign).not.toHaveBeenCalled();
		expect(written).toEqual([]);
	});

	it("refuses to move nothing", async () => {
		const sign = vi.fn();
		const { ports: p } = ports({ sign });

		const answer = await withdrawFunds(p, { ...request, lamports: "0" });

		expect(answer).toMatchObject({ status: "refused", rule: "invalid_amount" });
		expect(sign).not.toHaveBeenCalled();
	});

	it("refuses when the owner's wallet is the machine's own", async () => {
		const sign = vi.fn();
		const { ports: p } = ports({
			sign,
			machineFor: async () => ({
				wallet: parseAddress(MACHINE_WALLET),
				ownerWallet: parseAddress(MACHINE_WALLET),
				providerWalletId: "wallet-9f2c",
			}),
		});

		const answer = await withdrawFunds(p, request);

		expect(answer).toMatchObject({ status: "refused" });
		expect(sign).not.toHaveBeenCalled();
	});

	it("never signs bytes that pay anyone but the owner", async () => {
		// The check is the point of the whole path: if the built transaction disagrees with the request,
		// nothing is signed and nothing is sent.
		const sign = vi.fn();
		const { ports: p } = ports({
			sign,
			// Stands in for a build going wrong, or being tampered with, between request and signature.
			build: (transfer) => buildTransfer({ ...transfer, to: parseAddress(ELSEWHERE) }),
		});

		const answer = await withdrawFunds(p, request);

		expect(answer).toMatchObject({ status: "refused" });
		expect(sign).not.toHaveBeenCalled();
	});

	it("records a failure when the chain says it failed, with the signature", async () => {
		const { ports: p, written } = ports({
			confirm: async () => ({
				outcome: "failed",
				signature: "5".repeat(88),
				reason: "insufficient lamports",
			}),
		});

		const answer = await withdrawFunds(p, request);

		expect(answer).toMatchObject({ status: "refused", rule: "not_landed" });
		expect(types(written)).toEqual([
			"withdrawal.requested",
			"withdrawal.submitted",
			"withdrawal.failed",
		]);
		expect(written[2]?.payload).toMatchObject({ signature: "5".repeat(88) });
	});

	it("never sends twice for the same withdrawal", async () => {
		const send = vi.fn();
		const { ports: p } = ports({
			send,
			submissionFor: async () => ({
				signature: "5".repeat(88),
				lastValidBlockHeight: 426_070_577n,
			}),
		});

		const answer = await withdrawFunds(p, request);

		// Already signed once. Signing again could land a second payment, and no delay makes that safe.
		expect(send).not.toHaveBeenCalled();
		expect(answer).toMatchObject({ status: "sent" });
	});
});
