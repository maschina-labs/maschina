import { describe, expect, it } from "vitest";
import { canonicalJson, contentId } from "./content.ts";

const recipe = {
	kind: "recurring_buy",
	settings: { amount: "25000000", mint: "So11111111111111111111111111111111111111112" },
	rules: { maxPerTrade: "50000000", schedule: "weekly" },
};

describe("canonicalJson", () => {
	it("writes object keys in a fixed order, however they were written", () => {
		expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
		expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
	});

	it("writes every JSON value the same way JSON does", () => {
		expect(canonicalJson(true)).toBe("true");
		expect(canonicalJson(false)).toBe("false");
		expect(canonicalJson(null)).toBe("null");
		expect(canonicalJson(0)).toBe("0");
		expect(canonicalJson(-1.5)).toBe("-1.5");
		expect(canonicalJson("")).toBe('""');
		expect(canonicalJson([])).toBe("[]");
		expect(canonicalJson({})).toBe("{}");
	});

	it("sorts keys at every depth, not just the top", () => {
		const nested = { z: { b: [{ d: 1, c: 2 }], a: true } };
		expect(canonicalJson(nested)).toBe('{"z":{"a":true,"b":[{"c":2,"d":1}]}}');
	});

	it("keeps array order, which is part of the content", () => {
		expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
	});

	it("leaves out keys set to undefined, which JSON has no way to hold", () => {
		expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
	});

	it("refuses anything that can't be compared as content", () => {
		for (const value of [() => 1, Number.NaN, Number.POSITIVE_INFINITY, 1n, Symbol("x")]) {
			expect(() => canonicalJson(value), String(value)).toThrow();
		}
	});

	it("names where the problem is, so a deep recipe can be fixed", () => {
		expect(() => canonicalJson({ settings: { amounts: [1, 2n] } })).toThrow(
			/\$\.settings\.amounts\[1\]/,
		);
	});
});

describe("contentId", () => {
	it("gives the same id to the same recipe, whatever order it was written in", () => {
		const reordered = { rules: recipe.rules, kind: recipe.kind, settings: recipe.settings };
		expect(contentId(recipe)).toBe(contentId(reordered));
	});

	it("gives a different id to a changed recipe", () => {
		const changed = { ...recipe, settings: { ...recipe.settings, amount: "25000001" } };
		expect(contentId(changed)).not.toBe(contentId(recipe));
	});

	it("is 64 hex characters, like every other definition id", () => {
		expect(contentId(recipe)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("doesn't change between runs, so saved ids stay valid", () => {
		expect(contentId({ kind: "recurring_buy" })).toBe(contentId({ kind: "recurring_buy" }));
		expect(contentId("maschina")).toBe(
			"408578e67d4490a365f8673ffeed8fc45597520046cf217e381749e059de5d65",
		);
	});
});
