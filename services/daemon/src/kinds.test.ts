import { PRICE_WATCHING_KINDS, recurringBuy } from "@maschina/runtime";
import { describe, expect, it } from "vitest";
import { NODE_KINDS } from "./kinds.ts";

describe("what this node can run", () => {
	it("runs every kind the orchestrator queues work for", () => {
		// A kind that something queues runs for, and no node can run, is a machine that waits forever.
		for (const kind of PRICE_WATCHING_KINDS) {
			expect(NODE_KINDS.get(kind), `no node can run ${kind}`).toBeDefined();
		}
	});

	it("runs machines that work to a schedule", () => {
		expect(NODE_KINDS.get(recurringBuy.kind)).toBeDefined();
	});

	it("leaves a kind it has never heard of to somebody else", () => {
		expect(NODE_KINDS.get("something_from_the_future")).toBeUndefined();
	});
});
