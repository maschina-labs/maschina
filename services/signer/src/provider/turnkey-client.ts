/**
 * The real connection to Turnkey.
 *
 * Everything else works against `TurnkeyApi`, which is six methods wide. This file is the only place
 * that knows Turnkey's SDK exists, so the adapter can be tested without a network and a different
 * provider would replace this file rather than the logic above it.
 *
 * The key used here is the signer's, never a root key. Root users bypass policies entirely in Turnkey,
 * so signing machine wallets with one would make every policy in the system decorative.
 */

import { Turnkey } from "@turnkey/sdk-server";
import type { StoredPolicy, TurnkeyApi } from "./turnkey.ts";

export type TurnkeyConfig = {
	apiBaseUrl: string;
	/** The signer user's API key pair. Not a root key. */
	apiPublicKey: string;
	apiPrivateKey: string;
	organizationId: string;
};

export const TURNKEY_API = "https://api.turnkey.com";

/** Turnkey's client, narrowed to what the adapter uses. */
export function turnkeyApi(config: TurnkeyConfig): TurnkeyApi {
	const client = new Turnkey({
		apiBaseUrl: config.apiBaseUrl,
		apiPublicKey: config.apiPublicKey,
		apiPrivateKey: config.apiPrivateKey,
		defaultOrganizationId: config.organizationId,
	}).apiClient();

	return {
		async createWallet(body) {
			const created = await client.createWallet({
				walletName: body.walletName,
				accounts: [...body.accounts],
			});
			return { walletId: created.walletId, addresses: created.addresses };
		},

		async getWalletAccounts(body) {
			const { accounts } = await client.getWalletAccounts({ walletId: body.walletId });
			return {
				accounts: accounts.map((account) => ({
					address: account.address,
					addressFormat: account.addressFormat,
				})),
			};
		},

		async getPolicies() {
			const { policies } = await client.getPolicies({});
			return {
				policies: policies.map(
					(policy): StoredPolicy => ({
						policyId: policy.policyId,
						policyName: policy.policyName,
						effect: policy.effect,
						consensus: policy.consensus,
						condition: policy.condition,
					}),
				),
			};
		},

		async createPolicy(body) {
			const created = await client.createPolicy({
				policyName: body.policyName,
				effect: body.effect,
				condition: body.condition,
				consensus: body.consensus,
				notes: body.notes,
			});
			return { policyId: created.policyId };
		},

		async updatePolicy(body) {
			return client.updatePolicy({
				policyId: body.policyId,
				policyName: body.policyName,
				policyEffect: body.policyEffect,
				policyCondition: body.policyCondition,
				policyConsensus: body.policyConsensus,
				policyNotes: body.policyNotes,
			});
		},

		async signTransaction(body) {
			const signed = await client.signTransaction({
				signWith: body.signWith,
				unsignedTransaction: body.unsignedTransaction,
				type: body.type,
			});
			return { signedTransaction: signed.signedTransaction };
		},
	};
}

/**
 * Finds which Turnkey user an API key belongs to.
 *
 * The signer's user id is not a secret and not worth storing as one: it can always be found from the
 * key already in use, and looking it up means one less thing that can be configured wrongly.
 */
export async function signerUserIdFor(config: TurnkeyConfig): Promise<string> {
	const client = new Turnkey({
		apiBaseUrl: config.apiBaseUrl,
		apiPublicKey: config.apiPublicKey,
		apiPrivateKey: config.apiPrivateKey,
		defaultOrganizationId: config.organizationId,
	}).apiClient();

	const { users } = await client.getUsers({});
	const mine = users.find((user) =>
		user.apiKeys.some((key) => key.credential.publicKey === config.apiPublicKey),
	);
	if (!mine) throw new Error("no Turnkey user holds this API key");
	return mine.userId;
}
