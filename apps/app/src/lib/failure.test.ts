import { describe, expect, it } from "vitest";
import { failureMessage } from "./failure.ts";

describe("reading what went wrong", () => {
	it("reads the message from an error", () => {
		expect(failureMessage(new Error("no such machine"))).toBe("no such machine");
	});

	it("still says something readable when what was thrown is not an error", () => {
		expect(failureMessage("a string")).toBe("Unexpected error");
		expect(failureMessage(undefined)).toBe("Unexpected error");
	});
});
