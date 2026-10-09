import { describe, expect, it } from "vitest";
import { MENUS } from "./menus.ts";
import { SITEMAP } from "./sitemap.ts";

const all = SITEMAP.flatMap((column) => column.items);

describe("the sitemap", () => {
	it("has four columns, in this order", () => {
		expect(SITEMAP.map((column) => column.title)).toEqual([
			"Product",
			"Developers",
			"Company",
			"Legal",
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

	it("has the legal pages", () => {
		const legal = SITEMAP.find((column) => column.title === "Legal")?.items;
		expect(legal?.map((item) => item.label)).toEqual(["Terms", "Privacy"]);
		expect(legal?.map((item) => item.href)).toEqual(["/terms", "/privacy"]);
	});
});
