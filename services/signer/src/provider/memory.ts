/**
 * A wallet provider that lives in memory, for tests of everything that sits above the interface.
 *
 * It understands only its own made-up payments (`memoryPayment`), not real Solana transactions, and it
 * enforces the parts of the policy a payment can break: who is paid and how much. It holds no keys and
 * its "signature" proves nothing. It must never be wired into a running signer.
 */

import { randomBytes } from "node:crypto";
import { err, ok } from "@maschina/core";
import {
	type SolanaAddress,
	validatePolicy,
	validateRecipients,
	type WalletPolicy,
} from "./policy.ts";
import { providerError, type WalletProvider } from "./wallet-provider.ts";

const MARKER = "maschina-memory-payment";
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
	let number = 0n;
	for (const byte of bytes) number = (number << 8n) + BigInt(byte);
	let out = "";
	while (number > 0n) {
		out = BASE58[Number(number % 58n)] + out;
		number /= 58n;
	}
	const leadingZeros = bytes.findIndex((byte) => byte !== 0);
	return "1".repeat(leadingZeros === -1 ? bytes.length : leadingZeros) + out;
}

type Payment = { from: SolanaAddress; to: SolanaAddress; lamports: bigint };

/** An unsigned payment the in-memory provider can read. */
export function memoryPayment(payment: Payment): Uint8Array {
	return new TextEncoder().encode(
		JSON.stringify({ marker: MARKER, ...payment, lamports: payment.lamports.toString() }),
	);
}

function readPayment(bytes: Uint8Array): Payment | undefined {
	try {
		const value = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
		if (value["marker"] !== MARKER) return undefined;
		const { from, to, lamports } = value;
		if (typeof from !== "string" || typeof to !== "string" || typeof lamports !== "string") {
			return undefined;
		}
		return { from, to, lamports: BigInt(lamports) };
	} catch {
		return undefined;
	}
}

export function createMemoryWalletProvider(options: { down?: boolean } = {}): WalletProvider {
	const wallets = new Map<string, { address: SolanaAddress; policy: WalletPolicy }>();
	let next = 1;
	const outage = () =>
		err(providerError("unavailable", "the in-memory provider was created as down"));
	const missing = (walletId: string) =>
		err(providerError("not_found", "no wallet with that id", { walletId }));

	return {
		name: "memory",

		async createWallet({ policy }) {
			if (options.down) return outage();
			const valid = validatePolicy(policy);
			if (!valid.ok) return valid;
			const walletId = `memory-${next++}`;
			const address = base58(randomBytes(32));
			wallets.set(walletId, { address, policy: valid.value });
			return ok({ walletId, address });
		},

		async readPolicy(walletId) {
			if (options.down) return outage();
			const wallet = wallets.get(walletId);
			return wallet ? ok(wallet.policy) : missing(walletId);
		},

		async sign(walletId, unsignedTransaction) {
			if (options.down) return outage();
			const wallet = wallets.get(walletId);
			if (!wallet) return missing(walletId);
			const payment = readPayment(unsignedTransaction);
			if (!payment) return err(providerError("invalid", "not a payment this provider can read"));
			const { policy } = wallet;
			if (payment.from !== wallet.address) {
				return err(providerError("refused", "the payment isn't from this wallet"));
			}
			if (payment.to !== policy.owner && !policy.recipients.includes(payment.to)) {
				return err(
					providerError("refused", "the recipient isn't approved", { rule: "recipients" }),
				);
			}
			if (payment.lamports > policy.maxLamportsPerTransfer) {
				return err(
					providerError("refused", "the payment is over the size limit", {
						rule: "maxLamportsPerTransfer",
					}),
				);
			}
			const signed = new Uint8Array(unsignedTransaction.length + 1);
			signed.set(unsignedTransaction);
			return ok(signed);
		},

		async setRecipients(walletId, recipients) {
			if (options.down) return outage();
			const wallet = wallets.get(walletId);
			if (!wallet) return missing(walletId);
			const valid = validateRecipients(wallet.policy.owner, recipients);
			if (!valid.ok) return valid;
			wallet.policy = { ...wallet.policy, recipients: valid.value };
			return ok(wallet.policy);
		},
	};
}
