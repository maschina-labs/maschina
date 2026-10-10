import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales.ts";
import { CATALOGS, fill, messagesFor } from "./messages.ts";

/** Every path to a string in a catalog, so two catalogs can be compared by shape. */
function shape(value: unknown, path = ""): string[] {
	if (typeof value === "string") return [path];
	if (Array.isArray(value)) return value.flatMap((item, index) => shape(item, `${path}[${index}]`));
	if (value && typeof value === "object")
		return Object.entries(value).flatMap(([key, item]) =>
			shape(item, path ? `${path}.${key}` : key),
		);
	return [];
}

describe("the words of the site", () => {
	it("has English, which every other language is measured against", () => {
		expect(CATALOGS["en"]).toBeDefined();
		expect(messagesFor("en")).toBe(CATALOGS["en"]);
	});

	it("gives a language with no catalog the English words, never a gap", () => {
		expect(messagesFor("es")).toBe(CATALOGS["en"]);
	});

	it("holds every language it has to exactly the shape of English: no missing string, no extra, none left empty", () => {
		const english = shape(CATALOGS["en"]);
		for (const locale of LOCALES) {
			const catalog = CATALOGS[locale.code];
			if (!catalog) continue;
			expect(shape(catalog), locale.code).toEqual(english);
			for (const path of shape(catalog)) {
				const value = path
					.split(/\.|\[|\]/)
					.filter(Boolean)
					.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], catalog);
				expect(String(value).trim().length, `${locale.code} ${path}`).toBeGreaterThan(0);
			}
		}
	});

	it("writes English the way the site does: no long dashes, no placeholders, no shouting", () => {
		const all = shape(CATALOGS["en"]).map((path) =>
			path
				.split(/\.|\[|\]/)
				.filter(Boolean)
				.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], CATALOGS["en"]),
		);
		for (const text of all.map(String)) {
			expect(text).not.toMatch(
				new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
			);
			expect(text).not.toMatch(/lorem|\btodo\b|\btbd\b/i);
			expect(text).not.toMatch(/!/);
		}
	});
});

describe("filling a sentence in", () => {
	it("puts values where the braces are, in any order, so a language can order its words its own way", () => {
		expect(fill("Last updated {date}", { date: "October 9, 2026" })).toBe(
			"Last updated October 9, 2026",
		);
		expect(fill("{b} then {a}", { a: "1", b: "2" })).toBe("2 then 1");
	});

	it("leaves a brace with no value as it is, so a missing value shows rather than vanishing", () => {
		expect(fill("Hello {name}", {})).toBe("Hello {name}");
	});
});
