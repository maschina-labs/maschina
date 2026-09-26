import { newId } from "@maschina/core";
import { parseAddress, type SolanaRpc } from "@maschina/solana";
import { describe, expect, it, vi } from "vitest";
import { withdrawer } from "./compose.ts";

const MACHINE_WALLET = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";
const OWNER_WALLET = "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu";
const BLOCKHASH = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

/**
 * Fills in the signature a provider would have written.
 *
 * A transaction on the wire is a count, then 64 bytes per signature, then the message. An unsigned one
 * has zeroes there, which reads back as no signature at all, so a provider that returns the bytes
 * unchanged is not a provider that signed.
 */
function signedLike(transaction: Uint8Array): Uint8Array {
	const signed = new Uint8Array(transaction);
	signed.fill(7, 1, 65);
	return signed;
}

const request = {
	withdrawalId: newId<"withdrawal">(),
	machineId: newId<"machine">(),
	lamports: "250000000",
};

/**
 * An RPC node that answers the four things a withdrawal asks it, and records what it was sent.
 *
 * The point of testing the wiring rather than only the flow: a port connected to the wrong thing loses
 * money, and nothing in the flow's own tests would notice.
 */
function fakeRpc() {
	const sent: string[] = [];
	const rpc = {
		getLatestBlockhash: () => ({
			send: async () => ({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 426_070_577n } }),
		}),
		sendTransaction: (encoded: string) => ({
			send: async () => {
				sent.push(encoded);
				return "5".repeat(88);
			},
		}),
		getSignatureStatuses: () => ({
			send: async () => ({
				value: [{ confirmationStatus: "confirmed", err: null, slot: 426_070_000n }],
			}),
		}),
		getTransaction: () => ({
			send: async () => ({
				slot: 426_070_000n,
				meta: { fee: 5_000n, err: null, preBalances: [], postBalances: [] },
				transaction: { message: { accountKeys: [] } },
			}),
		}),
	} as unknown as SolanaRpc;
	return { rpc, sent };
}

describe("the withdrawer, wired to its real parts", () => {
	const machine = {
		wallet: parseAddress(MACHINE_WALLET),
		ownerWallet: parseAddress(OWNER_WALLET),
		providerWalletId: "wallet-9f2c",
	};

	it("builds, signs, sends and records a withdrawal through the real pieces", async () => {
		const { rpc, sent } = fakeRpc();
		const written: string[] = [];
		const sign = vi.fn(async (_walletId: string, transaction: Uint8Array) => ({
			ok: true as const,
			value: signedLike(transaction),
		}));

		const answer = await withdrawer({
			record: {
				machineFor: async () => machine,
				record: async (event) => {
					written.push(event.type);
				},
				submissionFor: async () => undefined,
			},
			provider: { sign } as never,
			rpc,
		}).withdraw(request);

		expect(answer).toMatchObject({ status: "sent", to: OWNER_WALLET });
		// One transaction, signed with the machine's own wallet at the provider, and sent once.
		expect(sign).toHaveBeenCalledWith("wallet-9f2c", expect.any(Uint8Array));
		expect(sent).toHaveLength(1);
		expect(written).toEqual([
			"withdrawal.requested",
			"withdrawal.submitted",
			"withdrawal.completed",
		]);
	});

	it("passes the provider's refusal back rather than pretending it sent", async () => {
		const { rpc, sent } = fakeRpc();

		const answer = await withdrawer({
			record: {
				machineFor: async () => machine,
				record: async () => undefined,
				submissionFor: async () => undefined,
			},
			provider: {
				sign: async () => ({
					ok: false,
					error: { kind: "refused", message: "the policy says no" },
				}),
			} as never,
			rpc,
		})
			.withdraw(request)
			.catch((error: unknown) => error);

		expect(sent).toEqual([]);
		expect(String(answer)).toContain("the policy says no");
	});
});
