import { describe, expect, it } from "vitest";
import { describeWalletProvider } from "./contract.ts";
import { memoryPayment, readMemoryPayment } from "./memory.ts";
import {
	classifyTurnkeyError,
	SOLANA_ACCOUNT,
	type StoredPolicy,
	type TurnkeyApi,
	turnkeyProvider,
} from "./turnkey.ts";

const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
const RECIPIENT = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const STRANGER = "H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E";
const SIGNER_USER = "0199a0a0-0000-4000-8000-000000000001";

/**
 * A stand-in for Turnkey that keeps wallets and policies, and enforces the stored policy the way
 * Turnkey would: by reading the transaction and the policy expression, not by remembering what it was
 * told. It holds no keys and its signature proves nothing.
 */
function fakeTurnkey(options: { failWith?: Error } = {}) {
	const wallets = new Map<string, string>();
	const policies: StoredPolicy[] = [];
	let nextWallet = 0;
	const created: string[] = [];
	const updated: string[] = [];

	/** Real Solana addresses, so the policy language sees what it would really be given. */
	const ADDRESSES = [
		"5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
		"BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n",
		"CfZaYTfQ7YyeWv8XvcZ7amMAAcE83DLL2mNeef46Dvp7",
		"9Vh6fqJjDkqSTZ8bDXseVxGb2yQEMkEhhtte2anQCHSf",
		"7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
		"Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
		"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	];

	const check = () => {
		if (options.failWith) throw options.failWith;
	};

	const api: TurnkeyApi = {
		async createWallet(body) {
			check();
			expect(body.accounts[0]).toEqual(SOLANA_ACCOUNT);
			const address = ADDRESSES[nextWallet];
			if (!address) throw new Error("the fake has run out of wallet addresses");
			nextWallet += 1;
			const walletId = `wallet-${nextWallet}`;
			wallets.set(walletId, address);
			return { walletId, addresses: [address] };
		},

		async getWalletAccounts({ walletId }) {
			check();
			const address = wallets.get(walletId);
			if (!address) throw new Error("wallet not found");
			return { accounts: [{ address, addressFormat: SOLANA_ACCOUNT.addressFormat }] };
		},

		async getPolicies() {
			check();
			return { policies: policies.map((policy) => ({ ...policy })) };
		},

		async createPolicy(body) {
			check();
			created.push(body.policyName);
			policies.push({ policyId: `policy-${policies.length + 1}`, ...body });
			return { policyId: `policy-${policies.length}` };
		},

		async updatePolicy(body) {
			check();
			updated.push(body.policyName);
			const found = policies.findIndex((policy) => policy.policyId === body.policyId);
			if (found < 0) throw new Error("policy not found");
			policies[found] = {
				policyId: body.policyId,
				policyName: body.policyName,
				effect: body.policyEffect,
				consensus: body.policyConsensus,
				condition: body.policyCondition,
			};
			return {};
		},

		async signTransaction({ signWith, unsignedTransaction }) {
			check();
			const payment = readMemoryPayment(new Uint8Array(Buffer.from(unsignedTransaction, "hex")));
			if (!payment) throw new Error("the transaction could not be read");

			const signing = policies.find(
				(policy) => policy.effect === "EFFECT_ALLOW" && policy.condition.includes(`'${signWith}'`),
			);
			if (!signing) throw new Error("no policy allows this: the activity was rejected");

			if (payment.from !== signWith) {
				throw new Error("the activity was rejected: signing for another wallet");
			}
			if (!signing.condition.includes(`t.to == '${payment.to}'`)) {
				throw new Error("policy denied: that recipient is not approved");
			}
			const cap = /t\.amount <= (\d+)/.exec(signing.condition)?.[1];
			if (cap && payment.lamports > BigInt(cap)) {
				throw new Error("policy denied: over the transfer limit");
			}

			return { signedTransaction: `${unsignedTransaction}aa` };
		},
	};

	return { api, policies, created, updated };
}

const providerWith = (options: Parameters<typeof fakeTurnkey>[0] = {}) => {
	const fake = fakeTurnkey(options);
	// One fake stands in for both keys here. In production they are two different keys with two
	// different sets of permissions, which is the point of the split.
	return {
		...fake,
		provider: turnkeyProvider({ admin: fake.api, signer: fake.api, signerUserId: SIGNER_USER }),
	};
};

describeWalletProvider("turnkey", {
	provider: () => providerWith().provider,
	policy: {
		owner: OWNER,
		recipients: [RECIPIENT],
		approvedPrograms: ["11111111111111111111111111111111"],
		approvedMints: [],
		maxLamportsPerTransfer: 50_000_000n,
	},
	payment: (from, to) => memoryPayment({ from, to, lamports: 1_000_000n }),
	missingWalletId: "wallet-does-not-exist",
	stranger: STRANGER,
});

const policy = {
	owner: OWNER,
	recipients: [RECIPIENT],
	approvedPrograms: ["11111111111111111111111111111111"],
	approvedMints: [],
	maxLamportsPerTransfer: 50_000_000n,
};

describe("what turnkey is asked for", () => {
	it("writes both policies when a wallet is created", async () => {
		const setup = providerWith();

		const created = await setup.provider.createWallet({ label: "weekly", policy });

		expect(created.ok).toBe(true);
		expect(setup.created).toHaveLength(2);
		expect(setup.created.some((name) => name.endsWith(":sign"))).toBe(true);
		expect(setup.created.some((name) => name.endsWith(":no-export"))).toBe(true);
	});

	it("updates a policy in place rather than piling up new ones", async () => {
		const setup = providerWith();
		const created = await setup.provider.createWallet({ label: "weekly", policy });
		if (!created.ok) throw created.error;

		await setup.provider.setRecipients(created.value.walletId, [STRANGER]);

		expect(setup.policies).toHaveLength(2);
		// The same policy, edited, rather than a second one alongside it.
		expect(setup.updated).toHaveLength(1);
		expect(setup.updated[0]).toMatch(/:sign$/);
	});

	it("leaves a policy alone when nothing about it changed", async () => {
		const setup = providerWith();
		const created = await setup.provider.createWallet({ label: "weekly", policy });
		if (!created.ok) throw created.error;

		await setup.provider.setRecipients(created.value.walletId, [RECIPIENT]);

		expect(setup.updated).toHaveLength(0);
	});

	it("refuses to report a wallet as created when its policy did not stick", async () => {
		const setup = providerWith();
		// Turnkey accepts the policy and stores nothing, which is the failure that looks like success.
		setup.api.createPolicy = async () => ({ policyId: "nowhere" });

		const created = await setup.provider.createWallet({ label: "weekly", policy });

		expect(created.ok).toBe(false);
		expect(!created.ok && created.error.kind).toBe("unexpected");
	});

	it("refuses a wallet that would allow its key to be exported", async () => {
		const setup = providerWith();
		const realCreate = setup.api.createPolicy;
		setup.api.createPolicy = async (body) =>
			body.policyName.endsWith(":no-export")
				? { policyId: "skipped" }
				: realCreate.call(setup.api, body);

		const created = await setup.provider.createWallet({ label: "weekly", policy });

		expect(!created.ok && created.error.message).toMatch(/deny key export/);
	});

	it("refuses to sign nothing at all", async () => {
		const setup = providerWith();
		const created = await setup.provider.createWallet({ label: "weekly", policy });
		if (!created.ok) throw created.error;

		const signed = await setup.provider.sign(created.value.walletId, new Uint8Array());

		expect(!signed.ok && signed.error.kind).toBe("invalid");
	});

	it("reports an outage as unavailable and retryable", async () => {
		const setup = providerWith({ failWith: new Error("fetch failed: ETIMEDOUT") });

		const created = await setup.provider.createWallet({ label: "weekly", policy });

		expect(!created.ok && created.error).toMatchObject({ kind: "unavailable", retryable: true });
	});
});

describe("telling turnkey's failures apart", () => {
	it.each([
		["policy denied: recipient not approved", "refused"],
		["the activity was rejected", "refused"],
		["consensus needed", "refused"],
		["PolicyEnginePermissionError", "refused"],
		["fetch failed", "unavailable"],
		["ETIMEDOUT", "unavailable"],
		["429 too many requests", "unavailable"],
		["wallet not found", "not_found"],
		["something nobody has seen before", "unexpected"],
	])("reads %s as %s", (message, kind) => {
		expect(classifyTurnkeyError(new Error(message), "signing").kind).toBe(kind);
	});

	it("never retries a refusal, and always retries an outage", () => {
		expect(classifyTurnkeyError(new Error("policy denied"), "signing").retryable).toBe(false);
		expect(classifyTurnkeyError(new Error("socket hang up"), "signing").retryable).toBe(true);
	});

	it("keeps the original failure, so nothing is lost on the way out", () => {
		const original = new Error("policy denied");

		expect(classifyTurnkeyError(original, "signing").cause).toBe(original);
	});

	it("treats an unknown failure as a bug rather than a refusal", () => {
		// The dangerous mistake would be calling this refused: a refusal is a decision, and this is not.
		expect(classifyTurnkeyError({ weird: true }, "signing").kind).toBe("unexpected");
	});
});
