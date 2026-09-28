import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Graph } from "../lib/intel.ts";
import { IntelGraph } from "./intel-graph.tsx";

const graph: Graph = {
	nodes: [
		{ id: "owner", kind: "wallet", code: "WLT_OWN", label: "YOUR WALLET" },
		{ id: "m:1", kind: "machine", code: "MCH_01", label: "RANGE FINDER", machineId: "1" },
	],
	links: [{ from: "owner", to: "m:1", kind: "funds", count: 1 }],
};

describe("the money flow graph", () => {
	it("draws every object, and selects one when pressed", () => {
		const onSelect = vi.fn();
		render(<IntelGraph graph={graph} selected={undefined} onSelect={onSelect} />);

		fireEvent.click(screen.getByRole("button", { name: "MCH_01 RANGE FINDER" }));
		expect(onSelect).toHaveBeenCalledWith("m:1");
		expect(screen.getByRole("button", { name: "WLT_OWN YOUR WALLET" })).toBeInTheDocument();
	});
});
