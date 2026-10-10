import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { ROUTES, titleFor } from "./routes.ts";
import { SITEMAP } from "./sitemap.ts";

// Pages that live somewhere else and are not built here: the docs are their own app, the live record is to be a separate
// app, the status page is run by someone else, and the two AI files are plain files, not pages.
const ELSEWHERE = ["/docs", "/live", "/status", "/llms.txt", "/SKILL.md"];

const internal = (href: string | undefined): href is string => Boolean(href?.startsWith("/"));
const links = [
	...Object.values(MENUS).flatMap((menu) => [...menu.main, ...menu.aside].map((item) => item.href)),
	...SITEMAP.flatMap((column) => column.items.map((item) => item.href)),
	"/product",
	"/developers",
	"/company",
	"/papers",
	"/pricing",
].filter(internal);

describe("the pages", () => {
	it("has a page for every address the header, the menus, the search and the footer link to, except the ones that live elsewhere", () => {
		const missing = [...new Set(links)].filter(
			(href) => !ROUTES[href] && !ELSEWHERE.includes(href),
		);
		expect(missing).toEqual([]);
	});

	it("has no page for the ones that live elsewhere, and none for sign in or sign up, which are a separate app", () => {
		for (const href of ELSEWHERE) expect(ROUTES[href]).toBeUndefined();
		for (const href of ["/sign-in", "/sign-up", "/login", "/signup", "/auth"])
			expect(ROUTES[href]).toBeUndefined();
	});

	it("names each page, and finds a name with or without a trailing slash, and nothing for an unknown address", () => {
		expect(titleFor("/papers")).toBe("Papers");
		expect(titleFor("/papers/")).toBe("Papers");
		expect(titleFor("/risk")).toBe("Risk disclosure");
		expect(titleFor("/")).toBeUndefined();
		expect(titleFor("/nope")).toBeUndefined();
	});

	it("uses lower case addresses of plain words and dashes, as the links do", () => {
		for (const href of Object.keys(ROUTES)) expect(href).toMatch(/^\/[a-z]+(-[a-z]+)*$/);
	});
});
