import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineMachineKind } from "./machine.ts";

const recurringBuy = () =>
	defineMachineKind({
		id: "recurring-buy",
		label: "Recurring buy",
		settings: z.object({ everyHours: z.number().int().positive() }),
		decide: ({
			settings,
			state,
		}: {
			settings: { everyHours: number };
			state: { hoursSinceLast: number };
		}) =>
			state.hoursSinceLast >= settings.everyHours
				? { kind: "act" as const, action: { buy: true }, reason: "due" }
				: { kind: "skip" as const, reason: "not due yet" },
	});

describe("defineMachineKind", () => {
	it("returns a frozen kind that decides from its settings and state", async () => {
		const kind = recurringBuy();
		expect(Object.isFrozen(kind)).toBe(true);
		const settings = kind.settings.parse({ everyHours: 24 });
		expect(await kind.decide({ settings, state: { hoursSinceLast: 25 }, now: new Date() })).toEqual(
			{
				kind: "act",
				action: { buy: true },
				reason: "due",
			},
		);
		expect(await kind.decide({ settings, state: { hoursSinceLast: 1 }, now: new Date() })).toEqual({
			kind: "skip",
			reason: "not due yet",
		});
	});

	it.each(["", "Recurring", "a", "has space", "-leading", "trailing-", "x".repeat(70)])(
		"refuses the id %j",
		(id) => {
			expect(() =>
				defineMachineKind({
					id,
					label: "x",
					settings: z.object({}),
					decide: () => ({ kind: "skip", reason: "" }),
				}),
			).toThrow(MaschinaError);
		},
	);

	it("refuses an empty label", () => {
		expect(() =>
			defineMachineKind({
				id: "valid-id",
				label: "  ",
				settings: z.object({}),
				decide: () => ({ kind: "skip", reason: "" }),
			}),
		).toThrow(MaschinaError);
	});
});
