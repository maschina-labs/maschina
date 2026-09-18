import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { owners } from "./owners.ts";

describe("the owners table", () => {
	const table = getTableConfig(owners);

	it("keeps its name and columns", () => {
		expect(table.name).toBe("owners");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"created_at",
			"id",
			"wallet_address",
		]);
	});

	it("needs a wallet address, and fills in the rest", () => {
		const required = table.columns
			.filter((column) => column.notNull && !column.hasDefault)
			.map((column) => column.name);
		expect(required).toEqual(["wallet_address"]);
	});

	it("allows one owner per wallet address", () => {
		const unique = table.columns.filter((column) => column.isUnique).map((column) => column.name);
		expect(unique).toEqual(["wallet_address"]);
	});

	it("checks the shape of the address in the database itself", () => {
		expect(table.checks.map((check) => check.name)).toEqual(["owners_wallet_address_shape"]);
	});
});
