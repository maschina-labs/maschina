import { isAddress } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { newPaperAddress } from "./paper-address.ts";

describe("a paper machine's address", () => {
	it("is a real Solana address, so everything that shows one can show it", async () => {
		expect(isAddress(await newPaperAddress())).toBe(true);
	});

	it("is a different one every time, because the column it goes in is unique", async () => {
		const made = await Promise.all(Array.from({ length: 8 }, () => newPaperAddress()));

		expect(new Set(made).size).toBe(8);
	});

	it("hands back the address and nothing else: there is no key to hand back", async () => {
		const made = await newPaperAddress();

		expect(typeof made).toBe("string");
	});
});
