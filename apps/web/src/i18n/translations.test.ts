import { describe, expect, it } from "vitest";
import { AVAILABLE } from "./languages.ts";
import { isLocale } from "./locales.ts";
import { hash, type Seal, sourcesOf, type Translation } from "./translate.ts";

const words = import.meta.glob<{ default: Translation }>("./translations/*.ts", { eager: true });
const stamps = import.meta.glob<{ default: Seal }>("./translations/*.seal.json", { eager: true });
const sources = sourcesOf();

const flat = (translation: Translation): string[] =>
	[
		translation.catalog,
		...Object.values(translation.documents),
		...Object.values(translation.articles),
		translation.support,
		translation.papers,
		translation.brand,
	].flat();

/** What must come through a translation unchanged: the names of things, every number, every address of mail. */
const NAMES = [
	"Maschina",
	"Solana",
	"SOL",
	"PostHog",
	"Cloudflare",
	"GitHub",
	"Telegram",
	"Anthropic",
	"Google",
	"Resend",
	"Söhne",
	"Turnkey",
	"USDC",
];
const invariants = (text: string): string[] => [
	...NAMES.filter((name) => new RegExp(`(^|[^A-Za-z])${name}([^A-Za-z]|$)`).test(text)),
	...(text.match(/\d+/g) ?? []),
	...(text.match(/[\w.-]+@maschina\.dev/g) ?? []),
];

const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe("the languages that have translations", () => {
	const files = Object.keys(words).map((path) => path.replace(/^.*\//, "").replace(/\.ts$/, ""));

	it("offers exactly the languages that have both a translation and its fingerprints, and English", () => {
		expect([...AVAILABLE].sort()).toEqual(["en", ...files].sort());
	});

	it.each(files)("%s is a language on the list, with its fingerprints beside it", (code) => {
		expect(isLocale(code) && code !== "en", code).toBe(true);
		expect(stamps[`./translations/${code}.seal.json`], code).toBeDefined();
	});

	describe.each(files)("%s", (code) => {
		const translation = (words[`./translations/${code}.ts`] as { default: Translation }).default;
		const seal = (stamps[`./translations/${code}.seal.json`] as { default: Seal }).default;

		it("has a word for every place and a fingerprint for every word, in the same shape", () => {
			const shape = (value: Translation) => ({
				catalog: value.catalog.length,
				documents: Object.fromEntries(
					Object.entries(value.documents).map(([key, list]) => [key, list.length]),
				),
				articles: Object.fromEntries(
					Object.entries(value.articles).map(([key, list]) => [key, list.length]),
				),
				support: value.support.length,
				papers: value.papers.length,
				brand: value.brand.length,
			});
			expect(shape(translation)).toEqual(shape(seal));
		});

		it("writes the way the site does: nothing empty, no long dashes, no exclamation marks, no placeholders, no English pasted over a sentence", () => {
			const english = flat(sources);
			const mine = flat(translation);
			for (const [index, text] of mine.entries()) {
				expect(typeof text, `${code} #${index}`).toBe("string");
				expect(text.trim().length, `${code} #${index} is empty`).toBeGreaterThan(0);
				expect(text, `${code} #${index}`).not.toMatch(LONG_DASH);
				expect(text, `${code} #${index}`).not.toMatch(/!|！|¡/);
				expect(text, `${code} #${index}`).not.toMatch(/lorem|\btodo\b|\btbd\b/i);
				const source = english[index];
				if (source && source.length >= 40)
					expect(text, `${code} #${index} is still English`).not.toBe(source);
			}
		});

		it("keeps what must not change in every sentence that is still the English it was made from: names, numbers, addresses and the braces a value goes in", () => {
			const english = flat(sources);
			const mine = flat(translation);
			const sealed = flat(seal);
			let checked = 0;
			for (const [index, source] of english.entries()) {
				const text = mine[index];
				// Only a sentence whose English has not changed since can be held to it.
				if (text === undefined || sealed[index] !== hash(source)) continue;
				checked++;
				for (const token of invariants(source))
					expect(text, `${code} #${index} lost "${token}" from: ${source.slice(0, 60)}`).toContain(
						token,
					);
				expect((text.match(/\{\w+\}/g) ?? []).sort(), `${code} #${index} braces`).toEqual(
					(source.match(/\{\w+\}/g) ?? []).sort(),
				);
				if (source.length >= 25) {
					expect(text.length / source.length, `${code} #${index} length`).toBeGreaterThan(0.12);
					expect(text.length / source.length, `${code} #${index} length`).toBeLessThan(5);
				}
			}
			expect(checked).toBeGreaterThan(0);
		});
	});
});
