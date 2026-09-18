import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { machines } from "./machines.ts";

describe("the machines table", () => {
	const table = getTableConfig(machines);

	it("keeps its name and columns", () => {
		expect(table.name).toBe("machines");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"created_at",
			"definition_id",
			"id",
			"name",
			"owner_id",
			"provider",
			"provider_wallet_id",
			"wallet_address",
		]);
	});

	it("gives each machine its own wallet, so two can never share one", () => {
		const unique = table.columns.filter((column) => column.isUnique).map((column) => column.name);
		expect(unique).toEqual(["wallet_address"]);
	});

	it("links an owner and a definition, and won't have a machine without either", () => {
		const links = table.foreignKeys.map((key) => {
			const reference = key.reference();
			return `${reference.columns[0]?.name} -> ${getTableConfig(reference.foreignTable).name}`;
		});
		expect(links.sort()).toEqual(["definition_id -> machine_definitions", "owner_id -> owners"]);
		const required = table.columns
			.filter((column) => column.notNull && !column.hasDefault)
			.map((column) => column.name)
			.sort();
		expect(required).toEqual([
			"definition_id",
			"id",
			"name",
			"owner_id",
			"provider",
			"provider_wallet_id",
			"wallet_address",
		]);
	});

	it("checks the wallet address, the provider and the name in the database", () => {
		expect(table.checks.map((check) => check.name).sort()).toEqual([
			"machines_name_length",
			"machines_provider_known",
			"machines_wallet_address_shape",
		]);
	});

	it("indexes an owner's machines, since every screen lists them by owner", () => {
		expect(table.indexes.map((index) => index.config.name)).toEqual(["machines_owner"]);
	});
});
