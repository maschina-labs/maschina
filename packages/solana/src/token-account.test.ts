import { describe, expect, it } from "vitest";
import { TOKEN_2022_PROGRAM, TOKEN_PROGRAM, tokenAccountFor } from "./token-account.ts";

const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

// Worked out independently with solders, the Rust implementation, not with the library under test.
describe("where an owner's tokens of one kind live", () => {
	it("is the same account every other Solana tool would name", async () => {
		expect(await tokenAccountFor({ owner: OWNER, mint: USDC })).toBe(
			"2arVPHhzahANuftuDyHXP414ye2ARUgJvcbP9NHAsfnj",
		);
		expect(await tokenAccountFor({ owner: OWNER, mint: WRAPPED_SOL })).toBe(
			"CfZaYTfQ7YyeWv8XvcZ7amMAAcE83DLL2mNeef46Dvp7",
		);
	});

	it("differs by token program, because the program is part of the address", async () => {
		// Paying a vault into the wrong program's account is paying it into an account nobody can find.
		const classic = await tokenAccountFor({
			owner: OWNER,
			mint: USDC,
			tokenProgram: TOKEN_PROGRAM,
		});
		const newer = await tokenAccountFor({
			owner: OWNER,
			mint: USDC,
			tokenProgram: TOKEN_2022_PROGRAM,
		});

		expect(newer).toBe("ER5FhthBYn7zic5pe2WBpCGAwGAJNvkXhku62r2SYXNF");
		expect(newer).not.toBe(classic);
	});

	it("refuses an owner or a mint that is not an address", async () => {
		await expect(tokenAccountFor({ owner: "nope", mint: USDC })).rejects.toThrow(/address/);
		await expect(tokenAccountFor({ owner: OWNER, mint: "nope" })).rejects.toThrow(/address/);
	});
});
