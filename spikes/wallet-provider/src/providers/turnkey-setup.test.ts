import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SOLANA_PROGRAMS } from "../policy.ts";
import { setupMachineWallet, type TurnkeyAdmin } from "./turnkey-setup.ts";

const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SIGNER_ID = "5f7c1d2a-3b4c-4d5e-8f60-718293a4b5c6";
const KEYS = { publicKey: `02${"a".repeat(64)}`, privateKey: "b".repeat(64) };

type Policy = {
	policyId: string;
	policyName: string;
	effect: "EFFECT_ALLOW" | "EFFECT_DENY";
	consensus: string;
	condition: string;
	notes: string;
};

/** An in-memory Turnkey organisation that records what was done to it. */
function fakeTurnkey(options: { mangleConditions?: boolean } = {}) {
	const log: string[] = [];
	const users: {
		userId: string;
		userName: string;
		apiKeys: { credential: { publicKey: string } }[];
	}[] = [];
	const wallets: { walletId: string; walletName: string }[] = [];
	const policies: Policy[] = [];
	let next = 0;
	const admin: TurnkeyAdmin = {
		getUsers: async () => ({ users }),
		createUsers: async ({ users: created }) => {
			log.push("createUsers");
			for (const u of created) {
				users.push({
					userId: SIGNER_ID,
					userName: u.userName,
					apiKeys: u.apiKeys.map((k) => ({ credential: { publicKey: k.publicKey } })),
				});
			}
			return { userIds: [SIGNER_ID] };
		},
		getWallets: async () => ({ wallets }),
		createWallet: async ({ walletName }) => {
			log.push("createWallet");
			wallets.push({ walletId: "w1", walletName });
			return { walletId: "w1", addresses: [WALLET] };
		},
		getWalletAccounts: async () => ({
			accounts: [{ address: WALLET, addressFormat: "ADDRESS_FORMAT_SOLANA" }],
		}),
		getPolicies: async () => ({ policies }),
		createPolicy: async (body) => {
			log.push(`createPolicy ${body.policyName}`);
			const policyId = `p${next++}`;
			const condition = options.mangleConditions ? `${body.condition} ` : (body.condition ?? "");
			policies.push({ ...body, policyId, consensus: body.consensus ?? "", condition });
			return { policyId };
		},
		updatePolicy: async (body) => {
			log.push(`updatePolicy ${body.policyName}`);
			const policy = policies.find((p) => p.policyId === body.policyId);
			if (!policy) throw new Error("no such policy");
			Object.assign(policy, {
				effect: body.policyEffect,
				consensus: body.policyConsensus,
				condition: body.policyCondition,
			});
			return {};
		},
	};
	return { admin, log, users, policies };
}

const settings = {
	approvedPrograms: [SOLANA_PROGRAMS.system, SOLANA_PROGRAMS.token],
	approvedMints: [USDC],
	maxLamportsPerTransfer: 100_000_000n,
};

const run = (
	admin: TurnkeyAdmin,
	overrides: Partial<Parameters<typeof setupMachineWallet>[0]> = {},
) => {
	const stored: string[] = [];
	const promise = setupMachineWallet({
		admin,
		label: "test",
		ownerAddress: OWNER,
		signerPublicKey: undefined,
		storeSigner: async (keys) => {
			stored.push(keys.publicKey);
		},
		newKeyPair: () => KEYS,
		settings,
		...overrides,
	});
	return { promise, stored };
};

describe("setupMachineWallet", () => {
	it("creates the signer, the wallet and its policies, and checks them", async () => {
		const turnkey = fakeTurnkey();
		const { promise, stored } = run(turnkey.admin);
		const result = await promise;
		assert.deepEqual(result, {
			signerUserId: SIGNER_ID,
			walletId: "w1",
			walletAddress: WALLET,
			changed: ["signer", "wallet", "machine:test:sign", "machine:test:no-export"],
		});
		assert.deepEqual(stored, [KEYS.publicKey]);
		assert.equal(turnkey.users[0]?.userName, "spike-signer");
		assert.ok(turnkey.policies.every((p) => p.consensus.includes(SIGNER_ID)));
		assert.ok(
			turnkey.policies.some((p) => p.condition.includes(`wallet_account.address == '${WALLET}'`)),
		);
	});

	it("changes nothing when run again", async () => {
		const turnkey = fakeTurnkey();
		await run(turnkey.admin).promise;
		const before = turnkey.log.length;
		const again = await run(turnkey.admin, { signerPublicKey: KEYS.publicKey }).promise;
		assert.deepEqual(again.changed, []);
		assert.equal(turnkey.log.length, before);
	});

	it("saves the signer's key before creating the user, and creates nothing if saving fails", async () => {
		const turnkey = fakeTurnkey();
		const { promise } = run(turnkey.admin, {
			storeSigner: async () => {
				throw new Error("infisical unavailable");
			},
		});
		await assert.rejects(promise, /infisical unavailable/);
		assert.deepEqual(turnkey.log, []);
	});

	it("stops when the signer exists but its key isn't the one saved", async () => {
		const turnkey = fakeTurnkey();
		await run(turnkey.admin).promise;
		const before = turnkey.log.length;
		await assert.rejects(
			run(turnkey.admin, { signerPublicKey: undefined }).promise,
			/spike-signer already exists/,
		);
		await assert.rejects(
			run(turnkey.admin, { signerPublicKey: `03${"c".repeat(64)}` }).promise,
			/spike-signer already exists/,
		);
		assert.equal(turnkey.log.length, before);
	});

	it("brings a changed policy back in line", async () => {
		const turnkey = fakeTurnkey();
		await run(turnkey.admin).promise;
		const sign = turnkey.policies.find((p) => p.policyName === "machine:test:sign");
		assert.ok(sign);
		sign.condition = "true";
		const result = await run(turnkey.admin, { signerPublicKey: KEYS.publicKey }).promise;
		assert.deepEqual(result.changed, ["machine:test:sign"]);
		assert.notEqual(sign.condition, "true");
	});

	it("adds the wallet's own accounts as SOL recipients when asked", async () => {
		const turnkey = fakeTurnkey();
		const own = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
		let askedFor = "";
		await run(turnkey.admin, {
			extraRecipients: async (wallet) => {
				askedFor = wallet;
				return [own];
			},
		}).promise;
		assert.equal(askedFor, WALLET);
		const sign = turnkey.policies.find((p) => p.policyName === "machine:test:sign");
		assert.ok(sign?.condition.includes(`(t.to == '${OWNER}' || t.to == '${own}')`));
	});

	it("fails when a policy reads back differently from what was set", async () => {
		const turnkey = fakeTurnkey({ mangleConditions: true });
		await assert.rejects(run(turnkey.admin).promise, /machine:test:sign doesn't match/);
	});
});
