import { describe, expect, it } from "vitest";
import { sentence } from "./home.tsx";

describe("a sentence", () => {
	it("is lower case after its first letter, but keeps token symbols as they are written", () => {
		expect(sentence("SOLD")).toBe("Sold");
		expect(sentence("0.1978 SOL · GOT 24.22 USDC")).toBe("0.1978 SOL · got 24.22 USDC");
		expect(sentence("solar panels")).toBe("Solar panels");
	});
});
