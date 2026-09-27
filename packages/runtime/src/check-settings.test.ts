import { describe, expect, it } from "vitest";
import { checkMachineSettings } from "./check-settings.ts";
import { KNOWN_KINDS } from "./kinds/index.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const range = {
	quoteMint: USDC,
	baseMint: SOL,
	buyLevel: "118000000",
	sellLevel: "122000000",
	amountPerBuy: "10000000",
};

const check = (kind: string, settings: unknown, approvedMints: readonly string[] = [USDC, SOL]) =>
	checkMachineSettings(KNOWN_KINDS, { kind, settings, approvedMints });

describe("checking a machine before it is made", () => {
	it("accepts a range machine whose band covers its costs and whose tokens are approved", () => {
		expect(check("range", range)).toEqual({ ok: true });
	});

	it("refuses a kind nobody built", () => {
		const checked = check("rnage", range);
		expect(checked).toMatchObject({ ok: false });
		expect(!checked.ok && checked.problem).toMatch(/rnage/);
	});

	it("refuses a band too narrow to cover what trading it costs, before any money is behind it", () => {
		const narrow = { ...range, buyLevel: "120000000", sellLevel: "120100000" };
		const checked = check("range", narrow);
		expect(!checked.ok && checked.problem).toMatch(/basis points/);
	});

	it("refuses settings that cannot be read, and says why", () => {
		const checked = check("range", { ...range, sellLevel: "100000000" });
		expect(!checked.ok && checked.problem).toMatch(/above the bottom/);
	});

	it("refuses a machine whose budget is in a token the owner did not approve", () => {
		// Every trade would be refused by the rules. Better to say so now than after it is funded.
		const checked = check("range", range, [SOL]);
		expect(!checked.ok && checked.problem).toMatch(/approved/);
	});

	it("refuses a machine that watches a price in a token the owner did not approve", () => {
		const checked = check("range", range, [USDC]);
		expect(!checked.ok && checked.problem).toMatch(/approved/);
	});
});
