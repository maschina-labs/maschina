import { describe, expect, it } from "vitest";
import { AVAILABLE, DEFAULT_LOCALE, LOCALES, localizePath, parsePath } from "./locales.ts";

describe("the languages", () => {
	it("are the twenty three on the list, English first, each under its own name", () => {
		expect(LOCALES.map((locale) => locale.code)).toEqual([
			"en",
			"es",
			"fr",
			"de",
			"it",
			"pt",
			"nl",
			"pl",
			"tr",
			"ru",
			"uk",
			"ar",
			"he",
			"hi",
			"bn",
			"zh",
			"zh-tw",
			"ja",
			"ko",
			"id",
			"vi",
			"th",
			"fil",
		]);
		expect(LOCALES.find((locale) => locale.code === "es")?.name).toBe("Español");
		expect(LOCALES.find((locale) => locale.code === "zh-tw")?.name).toBe("繁體中文");
		expect(DEFAULT_LOCALE).toBe("en");
	});

	it("read right to left in Arabic and Hebrew, and left to right in every other", () => {
		for (const locale of LOCALES)
			expect(locale.dir, locale.code).toBe(["ar", "he"].includes(locale.code) ? "rtl" : "ltr");
	});

	it("give each a language tag a browser knows: the code itself, and Traditional Chinese as zh-TW", () => {
		for (const locale of LOCALES) expect(locale.tag).toMatch(/^[a-z]{2,3}(-[A-Z]{2})?$/);
		expect(LOCALES.find((locale) => locale.code === "zh-tw")?.tag).toBe("zh-TW");
		expect(LOCALES.find((locale) => locale.code === "zh")?.tag).toBe("zh-CN");
	});

	it("offers only English until a language has all of its pages, so no language is offered that is not true", () => {
		expect(AVAILABLE).toEqual(["en"]);
	});
});

describe("telling the language from the address", () => {
	it("takes a language from the first part of the address, and gives back the page without it", () => {
		expect(parsePath("/es/terms")).toEqual({ locale: "es", path: "/terms" });
		expect(parsePath("/es")).toEqual({ locale: "es", path: "/" });
		expect(parsePath("/es/")).toEqual({ locale: "es", path: "/" });
		expect(parsePath("/zh-tw/about/")).toEqual({ locale: "zh-tw", path: "/about" });
	});

	it("reads an address with no language as English, and leaves it alone", () => {
		expect(parsePath("/terms")).toEqual({ locale: "en", path: "/terms" });
		expect(parsePath("/")).toEqual({ locale: "en", path: "/" });
		expect(parsePath("/llms.txt")).toEqual({ locale: "en", path: "/llms.txt" });
	});

	it("does not mistake a page for a language: only the listed codes count, and English is never a prefix", () => {
		expect(parsePath("/risk")).toEqual({ locale: "en", path: "/risk" });
		expect(parsePath("/xx/terms")).toEqual({ locale: "en", path: "/xx/terms" });
		expect(parsePath("/en/terms")).toEqual({ locale: "en", path: "/en/terms" });
		expect(parsePath("/pt-br/terms")).toEqual({ locale: "en", path: "/pt-br/terms" });
	});
});

describe("putting a language into an address", () => {
	it("puts the language in front of a page, the front page becoming just the language", () => {
		expect(localizePath("/terms", "es")).toBe("/es/terms");
		expect(localizePath("/", "es")).toBe("/es");
		expect(localizePath("/zh-tw/x".replace("/zh-tw", ""), "zh-tw")).toBe("/zh-tw/x");
	});

	it("leaves English addresses as they are, with no prefix", () => {
		expect(localizePath("/terms", "en")).toBe("/terms");
		expect(localizePath("/", "en")).toBe("/");
	});

	it("keeps a search and a fragment where they were", () => {
		expect(localizePath("/terms#liability", "es")).toBe("/es/terms#liability");
		expect(localizePath("/contact?topic=billing", "es")).toBe("/es/contact?topic=billing");
		expect(localizePath("/#top", "es")).toBe("/es#top");
	});

	it("never changes what is not a page of the site: other sites, mail, fragments, and the plain files and assets", () => {
		for (const href of [
			"https://github.com/maschina-labs",
			"mailto:legal@maschina.dev",
			"#section",
			"/llms.txt",
			"/llms-full.txt",
			"/SKILL.md",
			"/sitemap.xml",
			"/robots.txt",
			"/humans.txt",
			"/.well-known/security.txt",
			"/brand/kit/mark-white.svg",
			"/brand/maschina-brand-kit.zip",
			"/fonts/Sohne-400.woff2",
			"/showcase/dashboard.jpg",
			"/og-image.png",
		])
			expect(localizePath(href, "es"), href).toBe(href);
	});

	it("does not put a language on an address that already has one", () => {
		expect(localizePath("/es/terms", "es")).toBe("/es/terms");
		expect(localizePath("/es/terms", "fr")).toBe("/fr/terms");
	});
});
