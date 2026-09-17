import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	address,
	blockhash,
	compileTransaction,
	createTransactionMessage,
	getTransactionEncoder,
	pipe,
	type SignatureBytes,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { type DevnetRpc, devnetUrl, mainnetUrl, submitSigned } from "./devnet.ts";

const WALLET = address("6Xa6BehnAkS9tUui8hYgNs9qjFmuxZe2pGZm9k8u2uvh");

/** A transaction with a fake signature in place, as Turnkey would return it. */
function signedHex(): string {
	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(m) => setTransactionMessageFeePayer(WALLET, m),
		(m) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: blockhash("EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k"),
					lastValidBlockHeight: 1n,
				},
				m,
			),
	);
	const compiled = compileTransaction(message);
	const fakeSignature = new Uint8Array(64).fill(7) as SignatureBytes;
	const signed = { ...compiled, signatures: { ...compiled.signatures, [WALLET]: fakeSignature } };
	return Buffer.from(getTransactionEncoder().encode(signed)).toString("hex");
}

function fakeRpc(statuses: ({ confirmationStatus: string; err: unknown } | null)[]) {
	const sent: string[] = [];
	let polls = 0;
	const rpc = {
		sendTransaction: (wire: string) => ({
			send: async () => {
				sent.push(wire);
				return "ignored";
			},
		}),
		getSignatureStatuses: () => ({
			send: async () => ({ value: [statuses[Math.min(polls++, statuses.length - 1)] ?? null] }),
		}),
	} as unknown as DevnetRpc;
	return { rpc, sent, polls: () => polls };
}

const fast = { pollMs: 1, timeoutMs: 200 };

describe("submitSigned", () => {
	it("sends the transaction and waits until it is confirmed", async () => {
		const { rpc, sent, polls } = fakeRpc([
			null,
			{ confirmationStatus: "processed", err: null },
			{ confirmationStatus: "confirmed", err: null },
		]);
		const signature = await submitSigned(rpc, signedHex(), fast);
		assert.equal(sent.length, 1);
		assert.equal(signature.length >= 64 && signature.length <= 88, true);
		assert.equal(polls(), 3);
	});

	it("fails when the transaction lands with an error", async () => {
		const { rpc } = fakeRpc([
			{ confirmationStatus: "confirmed", err: { InstructionError: [0, "Custom"] } },
		]);
		await assert.rejects(submitSigned(rpc, signedHex(), fast), /InstructionError/);
	});

	it("gives up when the transaction never confirms", async () => {
		const { rpc } = fakeRpc([null]);
		await assert.rejects(submitSigned(rpc, signedHex(), fast), /not confirmed/);
	});

	it("refuses a transaction that hasn't been signed", async () => {
		const { rpc, sent } = fakeRpc([null]);
		const unsigned = signedHex().replace(/(07){64}/, "00".repeat(64));
		await assert.rejects(submitSigned(rpc, unsigned, fast), /not signed/);
		assert.equal(sent.length, 0);
	});
});

describe("mainnetUrl", () => {
	it("points at Helius mainnet with the same key", () => {
		assert.equal(mainnetUrl("abc"), "https://mainnet.helius-rpc.com/?api-key=abc");
	});
});

describe("devnetUrl", () => {
	it("points at Helius devnet with the key", () => {
		assert.equal(devnetUrl("abc"), "https://devnet.helius-rpc.com/?api-key=abc");
	});
});
