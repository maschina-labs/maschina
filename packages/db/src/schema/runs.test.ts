import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { runs } from "./runs.ts";

describe("the runs table", () => {
	const table = getTableConfig(runs);

	it("keeps its name and columns", () => {
		expect(table.name).toBe("runs");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"created_at",
			"due_at",
			"id",
			"lease_epoch",
			"lease_expires_at",
			"leased_by",
			"machine_id",
			"occurrence_key",
			"state",
		]);
	});

	it("allows one run per machine per occurrence, which is what stops a double buy", () => {
		expect(
			table.uniqueConstraints.map((constraint) => constraint.columns.map((column) => column.name)),
		).toEqual([["machine_id", "occurrence_key"]]);
	});

	it("checks the state and that a lease is never half set", () => {
		expect(table.checks.map((check) => check.name).sort()).toEqual([
			"runs_lease_complete",
			"runs_state_known",
		]);
	});

	it("indexes the queue by what is due", () => {
		expect(table.indexes.map((index) => index.config.name)).toEqual(["runs_due"]);
	});

	it("links to a machine, and needs one", () => {
		const links = table.foreignKeys.map((key) => {
			const reference = key.reference();
			return `${reference.columns[0]?.name} -> ${getTableConfig(reference.foreignTable).name}`;
		});
		expect(links).toEqual(["machine_id -> machines"]);
		const required = table.columns
			.filter((column) => column.notNull && !column.hasDefault)
			.map((column) => column.name)
			.sort();
		expect(required).toEqual(["due_at", "id", "machine_id", "occurrence_key"]);
	});
});
