import { describe, expect, it } from "vitest";
import { decodeBase58, encodeBase58 } from "./base58.ts";

describe("decodeBase58", () => {
	it("reads the bytes a base58 string stands for", () => {
		// The system program's address, which is thirty two zero bytes.
		expect(decodeBase58("11111111111111111111111111111111")).toEqual(new Uint8Array(32));
		expect(decodeBase58("2")).toEqual(new Uint8Array([1]));
		expect(decodeBase58("z")).toEqual(new Uint8Array([57]));
	});

	it("keeps every leading zero, which the arithmetic alone would lose", () => {
		expect(decodeBase58("112")).toEqual(new Uint8Array([0, 0, 1]));
	});

	it("reads a real address as thirty two bytes", () => {
		expect(decodeBase58("So11111111111111111111111111111111111111112")).toHaveLength(32);
		expect(decodeBase58("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toHaveLength(32);
	});

	it("is empty for an empty string", () => {
		expect(decodeBase58("")).toEqual(new Uint8Array());
	});

	it("refuses characters base58 leaves out, so a typo cannot become a different key", () => {
		for (const wrong of ["0", "O", "I", "l", "hello!", "not base58"]) {
			expect(() => decodeBase58(wrong)).toThrow("not base58");
		}
	});
});

describe("encodeBase58", () => {
	it("writes bytes the way an API expects to read them", () => {
		expect(encodeBase58(new Uint8Array(32))).toBe("11111111111111111111111111111111");
		expect(encodeBase58(new Uint8Array([1]))).toBe("2");
		expect(encodeBase58(new Uint8Array())).toBe("");
	});

	it("comes back to where it started, for addresses and for signatures", () => {
		for (const text of [
			"So11111111111111111111111111111111111111112",
			"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			"11112",
		]) {
			expect(encodeBase58(decodeBase58(text))).toBe(text);
		}
	});

	it("survives every byte a signature could hold", () => {
		const bytes = new Uint8Array(64);
		for (let index = 0; index < 64; index++) bytes[index] = (index * 7 + 3) % 256;

		expect(decodeBase58(encodeBase58(bytes))).toEqual(bytes);
	});
});
