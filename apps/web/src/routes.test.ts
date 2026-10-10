import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { ROUTES, titleFor } from "./routes.ts";
import { SITEMAP } from "./sitemap.ts";

const internal = (href: string | undefined): href is string => Boolean(href?.startsWith("/"));
const links = [
	...Object.values(MENUS).flatMap((menu) => [...menu.main, ...menu.aside].map((item) => item.href)),
	...SITEMAP.flatMap((column) => column.items.map((item) => item.href)),
	"/product",
	"/marketplace",
	"/network",
	"/mobile",
	"/developers",
	"/company",
	"/papers",
	"/pricing",
].filter(internal);

describe("the pages", () => {
	it("has a page for every single address the header, the menus, the search and the footer link to, with no exceptions", () => {
		const missing = [...new Set(links)].filter((href) => !ROUTES[href]);
		expect(missing).toEqual([]);
	});

	it("has the pages that are only tagged Soon as well, the docs, the live record, the status page and the two AI files", () => {
		for (const href of [
			"/marketplace",
			"/network",
			"/mobile",
			"/docs",
			"/live",
			"/status",
			"/llms.txt",
			"/SKILL.md",
		])
			expect(ROUTES[href], href).toBeDefined();
	});

	it("has no page for sign in or sign up, which are a separate app", () => {
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

	it("uses the addresses as the links write them: plain words and dashes, and the two file names", () => {
		for (const href of Object.keys(ROUTES))
			expect(href).toMatch(/^\/[A-Za-z]+(-[a-z]+)*(\.[a-z]+)?$/);
	});
});
