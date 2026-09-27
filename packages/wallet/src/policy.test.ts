import { describe, expect, it } from "vitest";
import { isSolanaAddress, validatePolicy, type WalletPolicy } from "./policy.ts";

const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
const RECIPIENT = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const SYSTEM = "11111111111111111111111111111111";
const SECOND_ACCOUNT = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";

const policy = (overrides: Partial<WalletPolicy> = {}): WalletPolicy => ({
	owner: OWNER,
	recipients: [RECIPIENT],
	approvedPrograms: [SYSTEM],
	approvedMints: [],
	tokenDestinations: "any",
	wrapsSol: false,
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
			["tokenDestinations", { tokenDestinations: ["nope"] }],
		] as const) {
			const result = validatePolicy(policy(bad));
			expect(result.ok, field).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe("invalid");
				expect(result.error.message).toContain(field);
			}
		}
	});

	it("sorts and deduplicates the token accounts a transfer may pay into", () => {
		const result = validatePolicy(
			policy({ tokenDestinations: [RECIPIENT, SECOND_ACCOUNT, RECIPIENT] }),
		);

		expect(result.ok && result.value.tokenDestinations).toEqual([RECIPIENT, SECOND_ACCOUNT].sort());
	});

	it("refuses an empty list of token destinations, because that already has a spelling", () => {
		// "Nowhere" is said by approving no mints. Two ways to say the same thing is how one of them ends
		// up meaning the other.
		const result = validatePolicy(policy({ tokenDestinations: [] }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toContain("tokenDestinations");
	});

	it("keeps an open destination open, which is what a trading wallet needs", () => {
		const result = validatePolicy(policy({ tokenDestinations: "any" }));

		expect(result.ok && result.value.tokenDestinations).toBe("any");
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
