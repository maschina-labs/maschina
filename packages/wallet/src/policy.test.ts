import { describe, expect, it } from "vitest";
import { isSolanaAddress, validatePolicy, type WalletPolicy } from "./policy.ts";

const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
const RECIPIENT = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const SYSTEM = "11111111111111111111111111111111";

const policy = (overrides: Partial<WalletPolicy> = {}): WalletPolicy => ({
	owner: OWNER,
	recipients: [RECIPIENT],
	approvedPrograms: [SYSTEM],
	approvedMints: [],
	maxLamportsPerTransfer: 50_000_000n,
	...overrides,
});

describe("isSolanaAddress", () => {
	it("accepts addresses that decode to 32 bytes, including the all-ones system program", () => {
		expect(isSolanaAddress(OWNER)).toBe(true);
		expect(isSolanaAddress(SYSTEM)).toBe(true);
	});

	it("refuses anything else", () => {
		for (const value of [
			"",
			"0OIl",
			`${OWNER}x`,
			OWNER.slice(0, 20),
			"' or 1==1 '",
			"1".repeat(33),
		]) {
			expect(isSolanaAddress(value), value).toBe(false);
		}
	});
});

describe("validatePolicy", () => {
	it("returns the policy with recipients and lists deduplicated and sorted", () => {
		const result = validatePolicy(
			policy({ recipients: [RECIPIENT, RECIPIENT], approvedPrograms: [SYSTEM, SYSTEM] }),
		);
		expect(result).toEqual({ ok: true, value: policy() });
	});

	it("refuses a bad address anywhere, naming the field, so nothing reaches a provider", () => {
		for (const [field, bad] of [
			["owner", { owner: "nope" }],
			["recipients", { recipients: ["nope"] }],
			["approvedPrograms", { approvedPrograms: ["nope"] }],
			["approvedMints", { approvedMints: ["nope"] }],
		] as const) {
			const result = validatePolicy(policy(bad));
			expect(result.ok, field).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe("invalid");
				expect(result.error.message).toContain(field);
			}
		}
	});

	it("refuses a size limit that isn't a positive whole number of lamports", () => {
		for (const max of [0n, -1n]) {
			expect(validatePolicy(policy({ maxLamportsPerTransfer: max })).ok).toBe(false);
		}
	});

	it("refuses a policy that approves no programs, since nothing could ever be signed", () => {
		expect(validatePolicy(policy({ approvedPrograms: [] })).ok).toBe(false);
	});

	it("doesn't list the owner as an extra recipient", () => {
		const result = validatePolicy(policy({ recipients: [OWNER, RECIPIENT] }));
		expect(result.ok && result.value.recipients).toEqual([RECIPIENT]);
	});
});
