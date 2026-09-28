import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Graph } from "../lib/intel.ts";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => <a href="/machines/1">{children}</a>,
}));

const { Dossier } = await import("./dossier.tsx");

const graph: Graph = {
	nodes: [
		{ id: "owner", kind: "wallet", code: "WLT_OWN", label: "YOUR WALLET" },
		{
			id: "m:1",
			kind: "machine",
			code: "MCH_01",
			label: "RANGE FINDER",
			machineId: "1",
			address: "6kSD",
		},
	],
	links: [{ from: "owner", to: "m:1", kind: "funds", count: 1 }],
};

describe("a dossier", () => {
	it("shows what the object is, its brief, and follows a link to another object", () => {
		const onSelect = vi.fn();
		render(
			<Dossier
				node={graph.nodes[1]}
				graph={graph}
				events={[]}
				brief={[{ level: "watch", text: "STOPPED · WITHDRAW WHAT IT HOLDS" }]}
				onSelect={onSelect}
			/>,
		);

		expect(screen.getByText("RANGE FINDER")).toBeInTheDocument();
		expect(screen.getByText("STOPPED · WITHDRAW WHAT IT HOLDS")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /6kSD/ })).toHaveAttribute(
			"href",
			"https://solscan.io/account/6kSD",
		);
		fireEvent.click(screen.getByRole("button", { name: /FUNDS → YOUR WALLET/ }));
		expect(onSelect).toHaveBeenCalledWith("owner");
	});

	it("asks for a selection when there is none", () => {
		render(<Dossier node={undefined} graph={graph} events={[]} brief={[]} onSelect={vi.fn()} />);
		expect(screen.getByText("SELECT AN OBJECT")).toBeInTheDocument();
	});
});
