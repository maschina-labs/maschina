import { describe, expect, it } from "vitest";
import { amount, priceOf } from "./format.ts";

describe("amounts on the record", () => {
	it("writes USDC with six decimals and SOL with nine, exactly, without a float in between", () => {
		expect(amount("12340000", 6)).toBe("12.34");
		expect(amount("1000000", 6)).toBe("1");
		expect(amount("500", 6)).toBe("0.0005");
		expect(amount("1500000000", 9)).toBe("1.5");
		expect(amount("9007199254740993000", 9)).toBe("9007199254.740993");
		expect(amount("0", 9)).toBe("0");
	});

	it("gives the price of a trade as USDC per SOL, and nothing when there was no SOL", () => {
		expect(priceOf("150000000", "1000000000")).toBe("150.00");
		expect(priceOf("12340000", "80000000")).toBe("154.25");
		expect(priceOf("1", "0")).toBeUndefined();
	});
});
