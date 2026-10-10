import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { FILES, leavesSite, ROUTES, titleFor } from "./routes.ts";
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
		const missing = [...new Set(links)].filter((href) => !ROUTES[href] && !FILES[href]);
		expect(missing).toEqual([]);
	});

	it("has the pages that are only tagged Soon as well, the docs and the live record", () => {
		for (const href of ["/marketplace", "/network", "/mobile", "/docs", "/live"])
			expect(ROUTES[href], href).toBeDefined();
	});

	it("says a link leaves the site when it goes to another address or to a plain file, and not when it goes to a page", () => {
		expect(leavesSite("https://github.com/maschina-labs")).toBe(true);
		expect(leavesSite("/llms.txt")).toBe(true);
		expect(leavesSite("/SKILL.md")).toBe(true);
		expect(leavesSite("/about")).toBe(false);
		expect(leavesSite("/")).toBe(false);
	});

	it("keeps the plain files for agents out of the pages: they are files served as they are, never a page of the site", () => {
		expect(FILES["/llms.txt"]).toBe("AI index");
		expect(FILES["/SKILL.md"]).toBe("Skill file");
		for (const href of Object.keys(FILES)) {
			expect(ROUTES[href], href).toBeUndefined();
			expect(href).toMatch(/^\/[A-Za-z-]+\.[a-z]+$/);
		}
	});

	it("tags the status page Soon until there is one, since it will be run by someone else and there is nothing to link to yet", () => {
		const status = MENUS["Developers"]?.aside.find((item) => item.label === "Status");
		expect(status).toBeDefined();
		expect(status?.href).toBeUndefined();
		expect(ROUTES["/status"]).toBeUndefined();
	});

	it("sends GitHub to the organization, not to one repository, and the changelog to the changelog on GitHub, which is where it lives", () => {
		const github = MENUS["Developers"]?.aside.find((item) => item.label === "GitHub");
		expect(github?.href).toBe("https://github.com/maschina-labs");
		const changelog = MENUS["Product"]?.aside.find((item) => item.label === "Changelog");
		expect(changelog?.href).toBe(
			"https://github.com/maschina-labs/maschina/blob/main/CHANGELOG.md",
		);
		expect(ROUTES["/changelog"]).toBeUndefined();
	});

	it("leaves the MCP server unlinked, tagged Soon, until there is one", () => {
		const mcp = MENUS["Developers"]?.aside.find((item) => item.label === "MCP server");
		expect(mcp).toBeDefined();
		expect(mcp?.href).toBeUndefined();
		expect(ROUTES["/mcp"]).toBeUndefined();
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
