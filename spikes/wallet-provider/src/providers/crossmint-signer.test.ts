import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type CrossmintSignerApi,
	machineScopes,
	type Scope,
	sameScopes,
	setupMachineSigner,
	UNEXPRESSIBLE_RULES,
} from "./crossmint-signer.ts";

const OWNER = "8GTgKXv5zWk4rL2qVbD7YcN3mPsH9aTfEjR1uQxZetpR";
const SIGNER = "5Hb3y8wQjZkT2mNvR4cXpL7sA9dFgE1uKoWiYtB6nVqM";
const SECRET = "ab".repeat(64);

describe("machineScopes", () => {
	it("allows only SOL, only to the owner, up to a limit per interval", () => {
		assert.deepEqual(machineScopes({ owner: OWNER, solLimit: "0.05", intervalSeconds: 60 }), [
			{
				type: "transfer",
				tokenLocator: "solana:sol",
				recipients: [OWNER],
				spendingLimit: { amount: "0.05", interval: 60 },
			},
		]);
	});

	it("can add SOL recipients, and tokens with their own recipients", () => {
		const own = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
		const mint = "So11111111111111111111111111111111111111112";
		assert.deepEqual(
			machineScopes({
				owner: OWNER,
				solLimit: "0.01",
				intervalSeconds: 60,
				extraSolRecipients: [own],
				tokens: [{ mint, recipients: [OWNER] }],
			}),
			[
				{
					type: "transfer",
					tokenLocator: "solana:sol",
					recipients: [OWNER, own],
					spendingLimit: { amount: "0.01", interval: 60 },
				},
				{ type: "transfer", tokenLocator: `solana:${mint}`, recipients: [OWNER] },
			],
		);
	});

	it("records every machine wallet rule Crossmint can't express", () => {
		assert.deepEqual(UNEXPRESSIBLE_RULES.map((rule) => rule.rule).sort(), [
			"approved programs",
			"size of a single transaction",
		]);
		for (const rule of UNEXPRESSIBLE_RULES) assert.ok(rule.why.length > 20, rule.rule);
	});
});

describe("sameScopes", () => {
	const scopes = machineScopes({ owner: OWNER, solLimit: "0.05", intervalSeconds: 60 });

	it("ignores ordering and how the amount is written", () => {
		const reordered: Scope[] = [
			{ ...scopes[0], spendingLimit: { amount: "0.050", interval: 60 } } as Scope,
		];
		assert.ok(sameScopes(reordered, scopes));
	});

	it("notices a different limit, interval, recipient or token", () => {
		const base = scopes[0] as Scope;
		for (const changed of [
			{ ...base, spendingLimit: { amount: "0.06", interval: 60 } },
			{ ...base, spendingLimit: { amount: "0.05", interval: 3600 } },
			{ ...base, recipients: [SIGNER] },
			{ ...base, tokenLocator: "solana:usdc" },
			{ ...base, spendingLimit: undefined },
		]) {
			assert.equal(sameScopes([changed as Scope], scopes), false, JSON.stringify(changed));
		}
		assert.equal(sameScopes([], scopes), false);
		assert.equal(sameScopes(undefined, scopes), false);
	});
});

function fakeCrossmint(existing: { address: string; scopes?: Scope[] }[] = []) {
	const log: string[] = [];
	const signers = existing.map((s) => ({
		type: "external-wallet",
		locator: `external-wallet:${s.address}`,
		status: "success",
		...s,
	}));
	const api: CrossmintSignerApi = {
		useServerSigner: async () => {
			log.push("use server");
		},
		signers: async () => signers,
		addSigner: async (address, scopes) => {
			log.push(`add ${address}`);
			signers.push({
				type: "external-wallet",
				locator: `external-wallet:${address}`,
				status: "success",
				address,
				scopes,
			});
		},
		removeSigner: async (address) => {
			log.push(`remove ${address}`);
			signers.splice(
				signers.findIndex((s) => s.address === address),
				1,
			);
		},
	};
	return { api, log };
}

const scopes = machineScopes({ owner: OWNER, solLimit: "0.05", intervalSeconds: 60 });

describe("setupMachineSigner", () => {
	it("saves a new signer's secret, then registers it with its scopes", async () => {
		const { api, log } = fakeCrossmint();
		const result = await setupMachineSigner({
			api,
			scopes,
			saved: undefined,
			newSigner: () => ({ address: SIGNER, secretHex: SECRET }),
			storeSecret: async () => {
				log.push("store");
			},
		});
		assert.deepEqual(result, { address: SIGNER, changed: ["signer"] });
		assert.deepEqual(log, ["store", "use server", `add ${SIGNER}`]);
	});

	it("changes nothing when the signer already has these scopes", async () => {
		const { api, log } = fakeCrossmint([{ address: SIGNER, scopes }]);
		const result = await setupMachineSigner({
			api,
			scopes,
			saved: { address: SIGNER, secretHex: SECRET },
			storeSecret: async () => {
				throw new Error("should not store");
			},
		});
		assert.deepEqual(result, { address: SIGNER, changed: [] });
		assert.deepEqual(log, []);
	});

	it("replaces the signer's scopes when they differ, since Crossmint can't edit them", async () => {
		const stale = machineScopes({ owner: OWNER, solLimit: "1", intervalSeconds: 60 });
		const { api, log } = fakeCrossmint([{ address: SIGNER, scopes: stale }]);
		const result = await setupMachineSigner({
			api,
			scopes,
			saved: { address: SIGNER, secretHex: SECRET },
			storeSecret: async () => {},
		});
		assert.deepEqual(result.changed, ["scopes"]);
		assert.deepEqual(log, ["use server", `remove ${SIGNER}`, `add ${SIGNER}`]);
	});

	it("creates nothing if the secret can't be saved", async () => {
		const { api, log } = fakeCrossmint();
		await assert.rejects(
			setupMachineSigner({
				api,
				scopes,
				saved: undefined,
				newSigner: () => ({ address: SIGNER, secretHex: SECRET }),
				storeSecret: async () => {
					throw new Error("infisical unavailable");
				},
			}),
			/infisical unavailable/,
		);
		assert.deepEqual(log, []);
	});

	it("fails when Crossmint doesn't store the scopes as set", async () => {
		const { api } = fakeCrossmint();
		const lossy: CrossmintSignerApi = {
			...api,
			addSigner: async (address) => api.addSigner(address, []),
		};
		await assert.rejects(
			setupMachineSigner({
				api: lossy,
				scopes,
				saved: undefined,
				newSigner: () => ({ address: SIGNER, secretHex: SECRET }),
				storeSecret: async () => {},
			}),
			/scopes don't match/,
		);
	});
});
