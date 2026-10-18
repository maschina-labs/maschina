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
	"/papers",
	"/pricing",
].filter(internal);

describe("the pages", () => {
	it("has a page for every single address the header, the menus, the search and the footer link to, with no exceptions", () => {
		const missing = [...new Set(links)].filter((href) => !ROUTES[href] && !FILES[href]);
		expect(missing).toEqual([]);
	});

	it("has the pages that are only tagged Soon as well", () => {
		for (const href of ["/marketplace", "/network", "/mobile"])
			expect(ROUTES[href], href).toBeDefined();
	});

	it("says a link leaves the site only when it goes to another address: the plain files are endpoints of this site, and so are its pages", () => {
		expect(leavesSite("https://github.com/maschina-labs")).toBe(true);
		expect(leavesSite("/llms.txt")).toBe(false);
		expect(leavesSite("/SKILL.md")).toBe(false);
		expect(leavesSite("/about")).toBe(false);
		expect(leavesSite("/")).toBe(false);
	});

	it("keeps the plain files for agents out of the pages: they are files served as they are, never a page of the site", () => {
		expect(FILES["/llms.txt"]).toBe("AI Index");
		expect(FILES["/SKILL.md"]).toBe("Skill File");
		for (const href of Object.keys(FILES)) {
			expect(ROUTES[href], href).toBeUndefined();
			expect(href).toMatch(/^\/[A-Za-z-]+\.[a-z]+$/);
		}
	});

	it("sends Status to the status page, which is run by someone else on its own address, so it is not a page here", () => {
		const status = MENUS["Developers"]?.aside.find((item) => item.label === "Status");
		expect(status?.href).toBe("https://status.maschina.dev");
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
		const mcp = MENUS["Developers"]?.aside.find((item) => item.label === "MCP Server");
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
		expect(titleFor("/risk")).toBe("Risk Disclosure");
		expect(titleFor("/")).toBeUndefined();
		expect(titleFor("/nope")).toBeUndefined();
	});

	it("uses the addresses as the links write them: plain words and dashes, and the two file names", () => {
		for (const href of Object.keys(ROUTES))
			expect(href).toMatch(/^\/[A-Za-z]+(-[a-z]+)*(\.[a-z]+)?$/);
	});

	it("keeps the quickstart on this site and sends the reference pages to the docs app", () => {
		const hrefs = Object.fromEntries(
			(MENUS["Developers"]?.main ?? []).map((item) => [item.label, item.href]),
		);
		expect(hrefs).toEqual({
			Docs: "/docs",
			API: "https://docs.maschina.dev/api",
			SDK: "https://docs.maschina.dev/sdk",
			"Machine Spec": "https://docs.maschina.dev/machine-spec",
			Templates: "https://docs.maschina.dev/templates",
		});
		const footer = SITEMAP.find((column) => column.title === "Developers")?.items ?? [];
		const byLabel = Object.fromEntries(footer.map((item) => [item.label, item.href]));
		// The quickstart IS the docs page, so the footer lists it once rather than twice under two
		// names. The one page a newcomer needs is here, written, not on a subdomain that is blank.
		expect(byLabel["Docs"]).toBe("/docs");
		expect(byLabel["Quickstart"]).toBeUndefined();
		expect(byLabel["Examples"]).toBe("https://docs.maschina.dev/examples");
		// /docs is a page here now, and is checked above. The rest are still the docs app's.
		for (const path of [
			"/developers",
			"/api",
			"/sdk",
			"/spec",
			"/quickstart",
			"/templates",
			"/examples",
		])
			expect(ROUTES[path], path).toBeUndefined();
	});
});
