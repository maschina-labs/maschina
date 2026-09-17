import { readdirSync, readFileSync } from "node:fs";
import { EVENT_TYPES } from "@maschina/contracts";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { events } from "./events.ts";

// The record's column names are part of the migration and of every query written against it. Renaming
// one silently would break reading history, so the names are pinned here.
describe("the events table", () => {
	const table = getTableConfig(events);

	it("is called events and keeps its column names", () => {
		expect(table.name).toBe("events");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"id",
			"lease_epoch",
			"machine_id",
			"occurred_at",
			"payload",
			"type",
		]);
	});

	it("requires everything except the values the database fills in", () => {
		const optional = table.columns
			.filter((column) => !column.notNull || column.hasDefault)
			.map((column) => column.name)
			.sort();
		expect(optional).toEqual(["id", "occurred_at", "payload"]);
	});

	it("has one primary key, the event id", () => {
		expect(table.columns.filter((column) => column.primary).map((c) => c.name)).toEqual(["id"]);
	});

	it("carries a constraint limiting the event type", () => {
		expect(table.checks.map((constraint) => constraint.name)).toEqual(["events_type_known"]);
	});

	it("has a migration for the constraint, so a running database enforces it too", () => {
		const folder = new URL("../../migrations/", import.meta.url);
		const applied = readdirSync(folder)
			.filter((file) => file.endsWith(".sql"))
			.map((file) => readFileSync(new URL(file, folder), "utf8"))
			.join("\n");
		expect(applied).toContain("events_type_known");
		for (const type of EVENT_TYPES) expect(applied, type).toContain(`'${type}'`);
	});

	it("indexes a machine's events by time, for reading a machine's history", () => {
		expect(table.indexes.map((index) => index.config.name)).toEqual(["events_machine_time"]);
		expect(
			table.indexes[0]?.config.columns.map((column) => (column as { name: string }).name),
		).toEqual(["machine_id", "occurred_at"]);
	});
});
