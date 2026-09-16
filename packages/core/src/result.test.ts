import { describe, expect, it } from "vitest";
import { err, ok, unwrap } from "./result.ts";

describe("Result", () => {
	it("unwraps a value", () => {
		expect(unwrap(ok(3))).toBe(3);
	});

	it("throws the error it holds", () => {
		const error = new Error("nope");
		expect(() => unwrap(err(error))).toThrow(error);
	});

	it("wraps a non-error in an Error before throwing", () => {
		expect(() => unwrap(err("nope"))).toThrow("nope");
	});
});
