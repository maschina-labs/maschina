import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CapabilitiesSection, MarketplaceSection, NetworkSection } from "./ecosystem-sections.tsx";

vi.mock("./globe.tsx", () => ({
	Globe: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));
describe("platform sections", () => {
	it("distinguishes working machine kinds from planned non-trading work", () => {
		render(<CapabilitiesSection />);
		expect(screen.getByText("Built today")).toBeInTheDocument();
		expect(screen.getByText("Planned capabilities")).toBeInTheDocument();
		expect(screen.getByText("Recurring buy")).toBeInTheDocument();
		expect(screen.getByText("Public-source research")).toBeInTheDocument();
	});
	it("marks the network and marketplace as upcoming and examples as illustrative", async () => {
		render(
			<>
				<NetworkSection />
				<MarketplaceSection />
			</>,
		);
		expect(screen.getAllByText("Coming soon")).toHaveLength(2);
		expect(screen.getByText(/does not show live operators/)).toBeInTheDocument();
		const examples = screen.getByRole("list", { name: "Example machine types" });
		expect(within(examples).getAllByRole("listitem")).toHaveLength(4);
		expect(screen.getByText(/marketplace is not open/)).toBeInTheDocument();
	});
});
