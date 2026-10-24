import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Site } from "./site.tsx";

vi.mock("./frame.tsx", () => ({
	Frame: ({ children }: { children: React.ReactNode }) => (
		<>
			<header>Header</header>
			<main>{children}</main>
			<footer>Footer</footer>
		</>
	),
}));
vi.mock("./hero.tsx", () => ({ Hero: () => <section aria-label="Hero">Hero</section> }));

vi.mock("./showcase.tsx", () => ({
	Showcase: () => <section aria-label="Preview">Preview</section>,
}));

vi.mock("./evidence-section.tsx", () => ({
	EvidenceSection: () => <section aria-label="Verify the record">Evidence</section>,
}));

vi.mock("./ecosystem-sections.tsx", () => ({
	CapabilitiesSection: () => <section aria-label="What you can build" />,
	NetworkSection: () => <section aria-label="Network" />,
	MarketplaceSection: () => <section aria-label="Marketplace" />,
}));
vi.mock("./paper-mode.tsx", () => ({ PaperMode: () => <section aria-label="Paper mode" /> }));

describe("homepage navigation", () => {
	it("keeps the complete product story in order with blank black framing bands", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = screen.getByRole("main");
		const sections = [...main.children].filter((node) => node.tagName === "SECTION");
		const names = [
			"Hero",
			"Preview",
			"How it works",
			"What you can build",
			"Your controls",
			"Paper mode",
			"Verify the record",
			"Network",
			"Marketplace",
			"For builders",
			"Questions",
			"Get Started",
		];
		expect(sections).toHaveLength(names.length);
		names.forEach((name, index) => {
			expect(sections[index]).toBe(screen.getByRole("region", { name }));
		});
		const nav = screen.getByRole("navigation", { name: "Explore Maschina" });
		for (const [name, href] of [
			["Machines", "/machines"],
			["Network", "/network"],
			["Marketplace", "/marketplace"],
		] as const)
			expect(within(nav).getByRole("link", { name: new RegExp(name) })).toHaveAttribute(
				"href",
				href,
			);
		expect(screen.getAllByRole("navigation")).toHaveLength(3);
		const bottom = main.lastElementChild;
		expect(bottom).toHaveAttribute("aria-hidden", "true");
		expect(bottom).toHaveClass("bg-black");
		expect(bottom?.textContent).toBe("");
		expect(screen.queryByText("Up next")).not.toBeInTheDocument();
	});
});
