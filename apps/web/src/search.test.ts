import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { PAGES_INDEX, search } from "./search.ts";

describe("the page index", () => {
	it("holds every page that exists in a dropdown, once, with where it is from", () => {
		const hrefs = PAGES_INDEX.map((hit) => hit.href);
		expect(new Set(hrefs).size).toBe(hrefs.length);
		const docs = PAGES_INDEX.find((hit) => hit.label === "Docs");
		expect(docs).toEqual({
			label: "Docs",
			href: "https://docs.maschina.dev",
			section: "Developers",
		});
	});

	it("leaves out what is not built yet, because there is nowhere to go", () => {
		const labels = PAGES_INDEX.map((hit) => hit.label);
		expect(labels).toContain("Security");
		for (const name of ["Marketplace", "Network", "Mobile"]) {
			expect(labels).not.toContain(name);
		}
		for (const hit of PAGES_INDEX) expect(hit.href).toBeTruthy();
	});

	it("includes the pages that are not in a dropdown", () => {
		expect(PAGES_INDEX.find((hit) => hit.label === "Pricing")?.href).toBe("/pricing");
	});

	it("covers every link in every dropdown that has an address", () => {
		const wanted = new Set(
			Object.values(MENUS).flatMap((menu) =>
				[...menu.main, ...menu.aside].flatMap((item) => (item.href ? [item.href] : [])),
			),
		);
		const have = new Set(PAGES_INDEX.map((hit) => hit.href));
		for (const href of wanted) expect(have.has(href)).toBe(true);
	});
});

describe("searching the pages", () => {
	it("matches on the name, ignoring case and spaces at the ends", () => {
		expect(search("  MACHINE ").map((hit) => hit.label)).toEqual(["Machine spec"]);
	});

	it("matches on the section too", () => {
		const labels = search("developers").map((hit) => hit.label);
		expect(labels).toContain("Docs");
		expect(labels).toContain("API");
	});

	it("gives every page for nothing typed, in the order of the menus", () => {
		expect(PAGES_INDEX.length).toBeGreaterThan(10);
		expect(search("")).toEqual(PAGES_INDEX);
		expect(search("   ")).toEqual(PAGES_INDEX);
	});

	it("gives nothing when nothing matches", () => {
		expect(search("zzzz")).toEqual([]);
		// ...while a real word does find something, so an always-empty search could not pass.
		expect(search("docs").length).toBeGreaterThan(0);
	});

	it("finds the papers page, which is a page of its own in the header", () => {
		expect(PAGES_INDEX.find((hit) => hit.label === "Papers")?.href).toBe("/papers");
		expect(search("whitepaper pap").map((hit) => hit.label)).toEqual([]);
		expect(search("paper").map((hit) => hit.label)).toContain("Papers");
	});
});
