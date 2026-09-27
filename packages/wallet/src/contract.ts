/**
 * The tests every wallet provider must pass. Each provider's own test file runs this suite with a
 * harness that knows how to build a real transaction for that provider.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { WalletPolicy } from "./policy.ts";
import type { WalletProvider } from "./wallet-provider.ts";

export type ProviderHarness = {
	provider: () => WalletProvider | Promise<WalletProvider>;
	/** A valid policy whose owner and recipient are real addresses for this provider. */
	policy: WalletPolicy;
	/** A vault's policy for the same owner: pays the owner, and nobody else. */
	vaultPolicy: WalletPolicy;
	/** An unsigned transaction from `from` paying `to` a small amount that is within the policy's limits. */
	payment: (from: string, to: string) => Uint8Array | Promise<Uint8Array>;
	/** A wallet id that doesn't exist. */
	missingWalletId: string;
	/** An address nobody approved. */
	stranger: string;
};

export function describeWalletProvider(name: string, harness: ProviderHarness) {
	describe(`${name} meets the wallet provider contract`, () => {
		let provider: WalletProvider;
		beforeEach(async () => {
			provider = await harness.provider();
		});

		const create = async () => {
			const created = await provider.createWallet({ label: "contract", policy: harness.policy });
			if (!created.ok) throw created.error;
			return created.value;
		};
		const [recipient] = harness.policy.recipients;
		if (!recipient) throw new Error("the harness policy needs at least one recipient");

		it("creates a wallet whose policy reads back exactly as set", async () => {
			const wallet = await create();
			expect(wallet.walletId).not.toBe("");
			expect(wallet.address).not.toBe("");
			expect(await provider.readPolicy(wallet.walletId)).toEqual({
				ok: true,
				value: harness.policy,
			});
		});

		it("refuses to create a wallet with an invalid policy", async () => {
			const result = await provider.createWallet({
				label: "contract",
				policy: { ...harness.policy, owner: "not an address" },
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error.kind).toBe("invalid");
		});

		it("signs a payment the policy allows", async () => {
			const wallet = await create();
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.address, recipient),
			);
			expect(signed.ok).toBe(true);
			if (signed.ok) expect(signed.value.length).toBeGreaterThan(0);
		});

		it("reports a payment the policy forbids as refused, with a reason, without throwing", async () => {
			const wallet = await create();
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.address, harness.stranger),
			);
			expect(signed.ok).toBe(false);
			if (!signed.ok) {
				expect(signed.error.kind).toBe("refused");
				expect(signed.error.retryable).toBe(false);
				expect(signed.error.message).not.toBe("");
			}
		});

		it("changes approved recipients in place: same wallet, new list, removed recipient refused", async () => {
			const wallet = await create();
			const updated = await provider.setRecipients(wallet.walletId, []);
			expect(updated).toEqual({ ok: true, value: { ...harness.policy, recipients: [] } });
			expect(await provider.readPolicy(wallet.walletId)).toEqual(updated);
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.address, recipient),
			);
			expect(!signed.ok && signed.error.kind).toBe("refused");

			const restored = await provider.setRecipients(wallet.walletId, [recipient]);
			expect(restored.ok).toBe(true);
			const again = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.address, recipient),
			);
			expect(again.ok).toBe(true);
		});

		it("refuses an invalid recipient list and leaves the policy unchanged", async () => {
			const wallet = await create();
			const result = await provider.setRecipients(wallet.walletId, ["not an address"]);
			expect(!result.ok && result.error.kind).toBe("invalid");
			expect(await provider.readPolicy(wallet.walletId)).toEqual({
				ok: true,
				value: harness.policy,
			});
		});

		const createWithVault = async () => {
			const created = await provider.createWallet({
				label: "contract",
				policy: harness.policy,
				vault: harness.vaultPolicy,
			});
			if (!created.ok) throw created.error;
			if (!created.value.vaultAddress) throw new Error("no vault was made");
			return { ...created.value, vaultAddress: created.value.vaultAddress };
		};

		it("makes a vault beside the trading account, at its own address, under its own policy", async () => {
			const wallet = await createWithVault();

			expect(wallet.vaultAddress).not.toBe(wallet.address);
			expect(await provider.readPolicy(wallet.walletId, "vault")).toEqual({
				ok: true,
				value: harness.vaultPolicy,
			});
			// The trading account's policy is untouched by the vault's.
			expect(await provider.readPolicy(wallet.walletId)).toEqual({
				ok: true,
				value: harness.policy,
			});
		});

		it("lets a vault pay its owner", async () => {
			const wallet = await createWithVault();
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.vaultAddress, harness.vaultPolicy.owner),
				"vault",
			);

			expect(signed.ok).toBe(true);
		});

		it("refuses a vault paying anybody else", async () => {
			const wallet = await createWithVault();
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.vaultAddress, harness.stranger),
				"vault",
			);

			expect(!signed.ok && signed.error.kind).toBe("refused");
		});

		it("signs as the vault only when the vault is asked for by name", async () => {
			// Defaulting to the trading account means nothing reaches the vault's key by accident.
			const wallet = await createWithVault();
			const signed = await provider.sign(
				wallet.walletId,
				await harness.payment(wallet.vaultAddress, harness.vaultPolicy.owner),
			);

			expect(signed.ok).toBe(false);
		});

		it("has no vault when none was asked for", async () => {
			const wallet = await create();

			expect(wallet.vaultAddress).toBeUndefined();
			expect(
				await provider.readPolicy(wallet.walletId, "vault").then((r) => !r.ok && r.error.kind),
			).toBe("not_found");
		});

		it("refuses a vault with an invalid policy, and makes no wallet", async () => {
			const result = await provider.createWallet({
				label: "contract",
				policy: harness.policy,
				vault: { ...harness.vaultPolicy, owner: "not an address" },
			});

			expect(!result.ok && result.error.kind).toBe("invalid");
		});

		it("reports an unknown wallet as not found for every operation", async () => {
			const id = harness.missingWalletId;
			const results = [
				await provider.readPolicy(id),
				await provider.sign(id, await harness.payment(harness.stranger, recipient)),
				await provider.setRecipients(id, []),
			];
			for (const result of results) expect(!result.ok && result.error.kind).toBe("not_found");
		});
	});
}
