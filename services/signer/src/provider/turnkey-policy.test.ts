import { describe, expect, it } from "vitest";
import type { WalletPolicy } from "./policy.ts";
import { policyFromExpressions, turnkeyPolicies } from "./turnkey-policy.ts";

const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const WALLET = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const PAYEE = "BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n";
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SYSTEM = "11111111111111111111111111111111";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIGNER = "0199a0a0-0000-4000-8000-000000000001";

const policy = (over: Partial<WalletPolicy> = {}): WalletPolicy => ({
	owner: OWNER,
	recipients: [],
	approvedPrograms: [SYSTEM, JUPITER],
	approvedMints: [USDC],
	maxLamportsPerTransfer: 1_000_000_000n,
	...over,
});

const build = (over: Partial<WalletPolicy> = {}) =>
	turnkeyPolicies({
		label: "weekly-sol",
		signerUserId: SIGNER,
		walletAddress: WALLET,
		policy: policy(over),
	});

describe("the policies a machine wallet gets", () => {
	it("allows signing only for this wallet, and only by its signer", () => {
		const [signing] = build();

		expect(signing?.effect).toBe("EFFECT_ALLOW");
		expect(signing?.condition).toContain("activity.kind == 'SIGN_TRANSACTION'");
		expect(signing?.condition).toContain(`wallet_account.address == '${WALLET}'`);
		expect(signing?.consensus).toBe(`approvers.any(user, user.id == '${SIGNER}')`);
	});

	it("denies exporting a key, whoever asks", () => {
		const [, noExport] = build();

		expect(noExport?.effect).toBe("EFFECT_DENY");
		expect(noExport?.condition).toBe("activity.action == 'EXPORT'");
	});

	it("allows only the approved programs", () => {
		const [signing] = build();

		expect(signing?.condition).toContain(`solana.tx.program_keys.all(p, p == '${SYSTEM}'`);
		expect(signing?.condition).toContain(`p == '${JUPITER}'`);
	});

	it("lets SOL go to the owner without anyone approving the owner", () => {
		const [signing] = build();

		expect(signing?.condition).toContain(`t.to == '${OWNER}'`);
	});

	it("lets SOL go to approved recipients as well as the owner", () => {
		const [signing] = build({ recipients: [PAYEE] });

		expect(signing?.condition).toContain(`t.to == '${OWNER}'`);
		expect(signing?.condition).toContain(`t.to == '${PAYEE}'`);
	});

	it("caps what one transfer may move", () => {
		const [signing] = build({ maxLamportsPerTransfer: 50_000n });

		expect(signing?.condition).toContain("t.amount <= 50000");
	});

	it("allows no token transfers at all when no mint is approved", () => {
		const [signing] = build({ approvedMints: [] });

		expect(signing?.condition).toContain("solana.tx.spl_transfers.count() == 0");
	});

	it("allows token transfers only in approved mints", () => {
		const [signing] = build();

		expect(signing?.condition).toContain(
			`solana.tx.spl_transfers.all(t, t.token_mint == '${USDC}')`,
		);
	});

	it("names its policies after the machine, so they can be found again", () => {
		const [signing, noExport] = build();

		expect(signing?.policyName).toBe("machine:weekly-sol:sign");
		expect(noExport?.policyName).toBe("machine:weekly-sol:no-export");
	});
});

describe("what it refuses to write into a policy", () => {
	it("refuses an address that is not an address", () => {
		// An address carrying a quote could close the expression and rewrite the rest of the policy.
		expect(() => build({ recipients: ["' || true || '"] })).toThrow(/invalid address/);
		expect(() => build({ owner: "not-an-address" })).toThrow(/invalid address/);
		expect(() => build({ approvedPrograms: [SYSTEM, "'; drop"] })).toThrow(/invalid address/);
		expect(() => build({ approvedMints: ["nope"] })).toThrow(/invalid address/);
	});

	it("refuses a label or signer id that is not one", () => {
		expect(() =>
			turnkeyPolicies({
				label: "Weekly SOL",
				signerUserId: SIGNER,
				walletAddress: WALLET,
				policy: policy(),
			}),
		).toThrow(/invalid label/);
		expect(() =>
			turnkeyPolicies({
				label: "ok",
				signerUserId: "root",
				walletAddress: WALLET,
				policy: policy(),
			}),
		).toThrow(/invalid signer user id/);
	});

	it("refuses a wallet address that is not an address", () => {
		expect(() =>
			turnkeyPolicies({
				label: "ok",
				signerUserId: SIGNER,
				walletAddress: "wallet-1",
				policy: policy(),
			}),
		).toThrow(/invalid wallet address/);
	});

	it("refuses a policy that could never sign anything", () => {
		expect(() => build({ approvedPrograms: [] })).toThrow(/no approved programs/);
	});

	it("refuses a transfer limit of nothing", () => {
		expect(() => build({ maxLamportsPerTransfer: 0n })).toThrow(/more than zero/);
	});
});

describe("reading a policy back out of its expressions", () => {
	it("returns exactly what went in", () => {
		const original = policy({ recipients: [PAYEE] });
		const specs = turnkeyPolicies({
			label: "weekly-sol",
			signerUserId: SIGNER,
			walletAddress: WALLET,
			policy: original,
		});

		expect(policyFromExpressions(specs)).toEqual(original);
	});

	it("reads a policy with no approved mints", () => {
		const original = policy({ approvedMints: [] });
		const specs = turnkeyPolicies({
			label: "weekly-sol",
			signerUserId: SIGNER,
			walletAddress: WALLET,
			policy: original,
		});

		expect(policyFromExpressions(specs)?.approvedMints).toEqual([]);
	});

	it("says nothing when there is no signing policy to read", () => {
		expect(policyFromExpressions([])).toBeUndefined();
		expect(
			policyFromExpressions([
				{
					policyName: "machine:x:sign",
					effect: "EFFECT_ALLOW",
					consensus: "",
					condition: "activity.kind == 'SIGN_TRANSACTION'",
					notes: "",
				},
			]),
		).toBeUndefined();
	});
});
