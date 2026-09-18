import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { definitionId, saveDefinition } from "./definitions.ts";

const recipe = {
	kind: "recurring_buy",
	settings: { amount: "25000000", mint: "So11111111111111111111111111111111111111112" },
	rules: { maxPerTrade: "50000000" },
};

const fakeDatabase = (rows: unknown[] = [{ id: "x" }]) => {
	const execute = vi.fn(async () => rows);
	return { db: { execute } as unknown as Database, execute };
};

describe("definitionId", () => {
	it("is the same for the same recipe, whatever order it was written in", () => {
		const reordered = { rules: recipe.rules, settings: recipe.settings, kind: recipe.kind };
		expect(definitionId(reordered)).toBe(definitionId(recipe));
	});

	it("changes when anything in the recipe changes", () => {
		expect(definitionId({ ...recipe, kind: "rebalance" })).not.toBe(definitionId(recipe));
		expect(definitionId({ ...recipe, rules: { maxPerTrade: "1" } })).not.toBe(definitionId(recipe));
	});

	it("ignores anything outside the recipe itself", () => {
		const withExtra = { ...recipe, savedBy: "someone", savedAt: "2026-09-17" };
		expect(definitionId(withExtra)).toBe(definitionId(recipe));
	});
});

describe("saveDefinition", () => {
	it("saves a new definition and says it created it", async () => {
		const { db } = fakeDatabase();
		const result = await saveDefinition(db, recipe);
		expect(result.ok && result.value).toEqual({ id: definitionId(recipe), created: true });
	});

	it("returns the same id without a second row when it already exists", async () => {
		const { db } = fakeDatabase([]);
		const result = await saveDefinition(db, recipe);
		expect(result.ok && result.value).toEqual({ id: definitionId(recipe), created: false });
	});

	it("refuses a kind that isn't a plain lower case name", async () => {
		const { db, execute } = fakeDatabase();
		for (const kind of ["", "Recurring Buy", "recurring-buy", "x", "'; drop table --"]) {
			const result = await saveDefinition(db, { ...recipe, kind });
			expect(result.ok, kind).toBe(false);
		}
		expect(execute).not.toHaveBeenCalled();
	});

	it("refuses a recipe holding something JSON can't carry", async () => {
		const { db, execute } = fakeDatabase();
		const result = await saveDefinition(db, {
			...recipe,
			settings: { amount: 25n } as unknown as Record<string, unknown>,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("invalid_input");
		expect(execute).not.toHaveBeenCalled();
	});
});
