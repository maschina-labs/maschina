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
			"user_id",
			"wallet_address",
		]);
	});

	it("needs only an id, because an owner is a wallet, a person or both and a check holds the rest", () => {
		const required = table.columns
			.filter((column) => column.notNull && !column.hasDefault)
			.map((column) => column.name)
			.sort();
		// The id comes from the code, because the database's own default was not a v7 id (#551).
		expect(required).toEqual(["id"]);
	});

	it("allows one owner per wallet address and one per person", () => {
		const unique = table.columns
			.filter((column) => column.isUnique)
			.map((column) => column.name)
			.sort();
		expect(unique).toEqual(["user_id", "wallet_address"]);
	});

	it("checks the shape of the address and the id in the database itself", () => {
		expect(table.checks.map((check) => check.name).sort()).toEqual([
			"owners_has_an_identity",
			"owners_id_is_v7",
			"owners_wallet_address_shape",
		]);
	});
});
