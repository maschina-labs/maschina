import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isSolanaAddress,
	type MachineWalletRules,
	machineWalletPolicies,
	SOLANA_PROGRAMS,
} from "./policy.ts";

const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const rules: MachineWalletRules = {
	signerUserId: "5f7c1d2a-3b4c-4d5e-8f60-718293a4b5c6",
	walletAddress: WALLET,
	transferRecipients: [OWNER],
	approvedPrograms: [SOLANA_PROGRAMS.system, SOLANA_PROGRAMS.token],
	approvedMints: [USDC],
	maxLamportsPerTransfer: 100_000_000n,
};

const byName = (label = "test") => {
	const policies = machineWalletPolicies(label, rules);
	return Object.fromEntries(policies.map((p) => [p.policyName, p]));
};

describe("isSolanaAddress", () => {
	it("accepts real addresses, including the all-ones system program", () => {
		for (const address of [...Object.values(SOLANA_PROGRAMS), OWNER, WALLET, USDC]) {
			assert.ok(isSolanaAddress(address), address);
		}
	});

	it("refuses anything that doesn't decode to 32 bytes", () => {
		for (const bad of [
			"TokenkegQfeZyiNwAJsyFbPVwwQQfjarXL2cKA5Eq1aAm",
			"1111111111111111111111111111111",
			"111111111111111111111111111111111",
			`${OWNER}1`,
			"0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl",
			"",
		]) {
			assert.equal(isSolanaAddress(bad), false, bad);
		}
	});
});

describe("machineWalletPolicies", () => {
	it("allows only the signer, only for this wallet, only for transactions", () => {
		const sign = byName()["machine:test:sign"];
		assert.ok(sign);
		assert.equal(sign.effect, "EFFECT_ALLOW");
		assert.equal(sign.consensus, `approvers.any(user, user.id == '${rules.signerUserId}')`);
		assert.match(sign.condition, /activity\.kind == 'SIGN_TRANSACTION'/);
		assert.match(sign.condition, new RegExp(`wallet_account\\.address == '${WALLET}'`));
	});

	it("limits programs, transfer recipients, transfer size and token mints", () => {
		const { condition } = byName()["machine:test:sign"] ?? { condition: "" };
		assert.match(
			condition,
			new RegExp(
				`solana\\.tx\\.program_keys\\.all\\(p, p == '${SOLANA_PROGRAMS.system}' \\|\\| p == '${SOLANA_PROGRAMS.token}'\\)`,
			),
		);
		assert.match(
			condition,
			new RegExp(
				`solana\\.tx\\.transfers\\.all\\(t, \\(t\\.to == '${OWNER}'\\) && t\\.amount <= 100000000\\)`,
			),
		);
		assert.match(
			condition,
			new RegExp(`solana\\.tx\\.spl_transfers\\.all\\(t, t\\.token_mint == '${USDC}'\\)`),
		);
	});

	it("groups several recipients so the size limit applies to all of them", () => {
		const second = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
		const { condition } = machineWalletPolicies("two", {
			...rules,
			transferRecipients: [OWNER, second],
		})[0] ?? { condition: "" };
		assert.ok(
			condition.includes(
				`solana.tx.transfers.all(t, (t.to == '${OWNER}' || t.to == '${second}') && t.amount <= 100000000)`,
			),
		);
	});

	it("allows no transfers or token transfers at all when their lists are empty", () => {
		const { condition } = machineWalletPolicies("empty", {
			...rules,
			transferRecipients: [],
			approvedMints: [],
		})[0] ?? { condition: "" };
		assert.match(condition, /solana\.tx\.transfers\.count\(\) == 0/);
		assert.match(condition, /solana\.tx\.spl_transfers\.count\(\) == 0/);
	});

	it("explicitly denies the signer exporting keys", () => {
		const deny = byName()["machine:test:no-export"];
		assert.ok(deny);
		assert.equal(deny.effect, "EFFECT_DENY");
		assert.equal(deny.condition, "activity.action == 'EXPORT'");
		assert.equal(deny.consensus, `approvers.any(user, user.id == '${rules.signerUserId}')`);
	});

	it("refuses anything that could change the meaning of a policy expression", () => {
		const injected = `${OWNER}' || true || '`;
		const cases: Array<[string, Partial<MachineWalletRules>]> = [
			["recipient", { transferRecipients: [injected] }],
			["wallet", { walletAddress: "not base58 0OIl" }],
			["program", { approvedPrograms: [injected] }],
			["mint", { approvedMints: ["short"] }],
			["signer", { signerUserId: "x' || true || '" }],
			["no programs", { approvedPrograms: [] }],
			["zero size", { maxLamportsPerTransfer: 0n }],
		];
		for (const [name, change] of cases) {
			assert.throws(() => machineWalletPolicies("test", { ...rules, ...change }), /invalid/i, name);
		}
		assert.throws(() => machineWalletPolicies("Bad Label", rules), /invalid/i);
	});
});
