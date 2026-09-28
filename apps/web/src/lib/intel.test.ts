import { describe, expect, it } from "vitest";
import { buildGraph, layout, vaultOf } from "./intel.ts";
import type { MachineSummary } from "./machines.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const machine = {
	machineId: "m1",
	name: "Range Finder",
	walletAddress: "6kSD",
	kind: "range",
} as MachineSummary;
const record = [
	{
		id: "1",
		type: "machine.created",
		occurredAt: "2026-09-28T05:20:13Z",
		payload: { vaultAddress: "6JTA" },
	},
	{
		id: "2",
		type: "trade.intended",
		occurredAt: "2026-09-28T06:22:36Z",
		payload: { tradeId: "t", inputMint: USDC, outputMint: SOL },
	},
	{
		id: "3",
		type: "trade.completed",
		occurredAt: "2026-09-28T06:22:39Z",
		payload: { tradeId: "t", inputAmount: "40350000", outputAmount: "339698000" },
	},
];

describe("the operating picture", () => {
	it("finds a machine's vault in its record", () => {
		expect(vaultOf(record)).toBe("6JTA");
		expect(vaultOf([])).toBeUndefined();
	});

	it("links the owner to each machine, each machine to its vault, and to the tokens it traded", () => {
		const graph = buildGraph("8GTg", [{ machine, record }]);

		expect(graph.nodes.map((node) => node.code)).toEqual([
			"WLT_OWN",
			"TKN_USDC",
			"TKN_SOL",
			"MCH_01",
			"VLT_01",
		]);
		expect(graph.links).toEqual([
			{ from: "owner", to: "m:m1", kind: "funds", count: 1 },
			{ from: "m:m1", to: "v:m1", kind: "banks", count: 0 },
			{ from: "m:m1", to: "sol", kind: "trades", count: 1 },
			{ from: "m:m1", to: "usdc", kind: "trades", count: 1 },
		]);
	});

	it("places the owner in the middle and every node somewhere", () => {
		const graph = buildGraph("8GTg", [{ machine, record }]);
		const at = layout(graph, 1000, 600);

		expect(at.get("owner")).toEqual({ x: 420, y: 300 });
		for (const node of graph.nodes) expect(at.get(node.id)).toBeDefined();
	});
});
