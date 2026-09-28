import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		search,
		...rest
	}: {
		children: React.ReactNode;
		search: { machine: string };
	}) => (
		<a
			href={`/?machine=${search.machine}`}
			aria-current={(rest as { "aria-current"?: boolean })["aria-current"]}
		>
			{children}
		</a>
	),
}));

const { FleetStrip } = await import("./fleet-strip.tsx");

const machine = (machineId: string, name: string) =>
	({
		machineId,
		name,
		kind: "range",
		state: "running",
		result: { realised: "370000" },
	}) as unknown as MachineSummary;

describe("the fleet strip", () => {
	it("numbers each machine like a slot, and lights the one being followed", () => {
		render(
			<FleetStrip
				machines={[machine("a", "Range Finder"), machine("b", "Paper range")]}
				following="b"
			/>,
		);

		const cells = screen.getAllByRole("link");
		expect(cells[0]).toHaveTextContent("01 // RANGE");
		expect(cells[0]).toHaveTextContent("RANGE FINDER");
		expect(cells[1]).toHaveAttribute("aria-current", "true");
		expect(cells[1]).toHaveAttribute("href", "/?machine=b");
	});

	it("shows nothing without machines", () => {
		const { container } = render(<FleetStrip machines={[]} following={undefined} />);
		expect(container).toBeEmptyDOMElement();
	});
});
