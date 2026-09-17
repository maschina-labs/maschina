import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type CrossmintWalletsApi,
	newServerSecret,
	setupCrossmintWallet,
} from "./crossmint-setup.ts";

const ADDRESS = "4jH3bY9ZqVuVxPmEf8kjk9A2cA4sTeKqzYpNrR3tUuWx";
const SECRET = `xmsk1_${"a".repeat(64)}`;

function fakeWallets() {
	const log: string[] = [];
	const api: CrossmintWalletsApi = {
		createWallet: async (args) => {
			log.push(`create ${args.chain} ${args.alias} ${args.recovery.type}`);
			return { address: ADDRESS };
		},
		getWallet: async (locator, args) => {
			log.push(`get ${locator} ${args.chain}`);
			return { address: locator };
		},
	};
	return { api, log };
}

const clock = () => {
	let t = 0;
	return () => (t += 1500);
};

describe("newServerSecret", () => {
	it("makes a Crossmint server secret: the prefix and 32 random bytes in hex", () => {
		const secret = newServerSecret();
		assert.match(secret, /^xmsk1_[0-9a-f]{64}$/);
		assert.notEqual(secret, newServerSecret());
	});
});

describe("setupCrossmintWallet", () => {
	it("saves a new secret, then creates a Solana wallet with it as the recovery signer", async () => {
		const { api, log } = fakeWallets();
		const stored: string[] = [];
		const result = await setupCrossmintWallet({
			wallets: api,
			label: "devnet",
			savedSecret: undefined,
			savedAddress: undefined,
			storeSecret: async (secret) => {
				stored.push(secret);
				log.push("store");
			},
			newSecret: () => SECRET,
			now: clock(),
		});
		assert.deepEqual(result, { address: ADDRESS, created: true, createMs: 1500 });
		assert.deepEqual(stored, [SECRET]);
		assert.deepEqual(log, ["store", "create solana spike-machine-devnet server"]);
	});

	it("creates nothing if the secret can't be saved", async () => {
		const { api, log } = fakeWallets();
		await assert.rejects(
			setupCrossmintWallet({
				wallets: api,
				label: "devnet",
				savedSecret: undefined,
				savedAddress: undefined,
				storeSecret: async () => {
					throw new Error("infisical unavailable");
				},
				newSecret: () => SECRET,
			}),
			/infisical unavailable/,
		);
		assert.deepEqual(log, []);
	});

	it("finds the existing wallet instead of creating another", async () => {
		const { api, log } = fakeWallets();
		const result = await setupCrossmintWallet({
			wallets: api,
			label: "devnet",
			savedSecret: SECRET,
			savedAddress: ADDRESS,
			storeSecret: async () => {
				throw new Error("should not store");
			},
		});
		assert.deepEqual(result, { address: ADDRESS, created: false });
		assert.deepEqual(log, [`get ${ADDRESS} solana`]);
	});

	it("stops when a wallet exists but its secret is missing, or the wallet can't be found", async () => {
		const { api } = fakeWallets();
		const base = { wallets: api, label: "devnet", storeSecret: async () => {} };
		await assert.rejects(
			setupCrossmintWallet({ ...base, savedSecret: undefined, savedAddress: ADDRESS }),
			/secret is missing/,
		);
		const lost: CrossmintWalletsApi = {
			...api,
			getWallet: async () => ({ address: "11111111111111111111111111111111" }),
		};
		await assert.rejects(
			setupCrossmintWallet({ ...base, wallets: lost, savedSecret: SECRET, savedAddress: ADDRESS }),
			/doesn't match/,
		);
	});

	it("uses a secret already saved when there is no wallet yet", async () => {
		const { api, log } = fakeWallets();
		const result = await setupCrossmintWallet({
			wallets: api,
			label: "devnet",
			savedSecret: SECRET,
			savedAddress: undefined,
			storeSecret: async () => {
				throw new Error("should not store");
			},
			now: clock(),
		});
		assert.equal(result.created, true);
		assert.deepEqual(log, ["create solana spike-machine-devnet server"]);
	});
});
