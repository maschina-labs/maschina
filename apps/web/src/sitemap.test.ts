import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { SITEMAP } from "./sitemap.ts";

const all = SITEMAP.flatMap((column) => column.items);

describe("the sitemap", () => {
	it("has five columns, in this order", () => {
		expect(SITEMAP.map((column) => column.title)).toEqual([
			"Product",
			"Developers",
			"Resources",
			"Company",
			"Legal",
		]);
	});

	it("keeps every column short enough to read at a glance: eight links at most", () => {
		for (const column of SITEMAP) expect(column.items.length).toBeLessThanOrEqual(8);
	});

	it("gathers the ways in and the things to check under Resources, from the menus' small links", () => {
		const labels = SITEMAP.find((c) => c.title === "Resources")?.items.map((i) => i.label);
		expect(labels).toEqual([
			"Papers",
			"Live record",
			"Changelog",
			"GitHub",
			"Status",
			"AI index",
			"Skill file",
			"MCP server",
		]);
	});

	it("is built from the header's own menus, so the two cannot drift apart", () => {
		const labels = (column: string) =>
			SITEMAP.find((c) => c.title === column)?.items.map((i) => i.label);
		for (const item of MENUS["Product"]?.main ?? [])
			expect(labels("Product")).toContain(item.label);
		for (const item of MENUS["Developers"]?.main ?? [])
			expect(labels("Developers")).toContain(item.label);
		for (const item of MENUS["Company"]?.main ?? []) {
			// Changelog is already under Product, and is listed once.
			if (item.label !== "Changelog") expect(labels("Company")).toContain(item.label);
		}
	});

	it("lists Pricing, which is a page of its own in the header, under Product", () => {
		const pricing = SITEMAP[0]?.items.find((item) => item.label === "Pricing");
		expect(pricing?.href).toBe("/pricing");
	});

	it("lists each address once, so a page is not repeated in two columns", () => {
		const addresses = all.flatMap((item) => (item.href ? [item.href] : []));
		expect(new Set(addresses).size).toBe(addresses.length);
	});

	it("keeps the pages that are not built yet without an address, so they can show as Soon", () => {
		for (const label of ["Marketplace", "Network", "Mobile"]) {
			const item = all.find((entry) => entry.label === label);
			expect(item).toBeDefined();
			expect(item?.href).toBeUndefined();
		}
	});

	it("puts the pages that are not built yet last in their column", () => {
		for (const column of SITEMAP) {
			const built = column.items.map((item) => Boolean(item.href));
			expect(built).toEqual([...built].sort((a, b) => Number(b) - Number(a)));
		}
	});

	it("knows which links leave the site: those with a full address", () => {
		const external = all.filter((item) => item.external).map((item) => item.label);
		expect(external.sort()).toEqual(["GitHub", "X"]);
		for (const item of all) expect(item.external).toBe(item.href?.startsWith("https://") ?? false);
	});

	it("has the legal pages, including the risk disclosure and the license", () => {
		const legal = SITEMAP.find((column) => column.title === "Legal")?.items;
		expect(legal?.map((item) => item.label)).toEqual([
			"Terms",
			"Privacy",
			"Risk disclosure",
			"Acceptable use",
			"License",
			"Security disclosure",
			"Preferences",
		]);
		expect(legal?.map((item) => item.href)).toEqual([
			"/terms",
			"/privacy",
			"/risk",
			"/acceptable-use",
			"/license",
			"/disclosure",
			// Preferences is not a page: it opens a toast.
			undefined,
		]);
		expect(legal?.at(-1)?.action).toBe("preferences");
	});

	it("has the product, developer and company pages that are still to be written", () => {
		const find = (column: string) => SITEMAP.find((c) => c.title === column)?.items ?? [];
		const hrefOf = (column: string, label: string) =>
			find(column).find((item) => item.label === label)?.href;
		expect(hrefOf("Product", "How it works")).toBe("/how-it-works");
		expect(hrefOf("Product", "Machines")).toBe("/machines");
		expect(hrefOf("Developers", "Quickstart")).toBe("/quickstart");
		expect(hrefOf("Developers", "Examples")).toBe("/examples");
		expect(hrefOf("Company", "Careers")).toBe("/careers");
		expect(hrefOf("Company", "Support")).toBe("/support");
		expect(hrefOf("Company", "Brand assets")).toBe("/brand");
	});

	it("reads Overview, how it works and machines first in Product, and Docs then Quickstart in Developers", () => {
		const labels = (column: string) =>
			SITEMAP.find((c) => c.title === column)?.items.map((i) => i.label);
		expect(labels("Product")?.slice(0, 3)).toEqual(["Overview", "How it works", "Machines"]);
		expect(labels("Developers")?.slice(0, 2)).toEqual(["Docs", "Quickstart"]);
	});
});
