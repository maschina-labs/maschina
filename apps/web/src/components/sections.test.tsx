import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	useRouterState: ({
		select,
	}: {
		select: (state: { location: { pathname: string } }) => unknown;
	}) => select({ location: { pathname: "/" } }),
}));

const { Sections } = await import("./sections.tsx");

describe("the header's sections", () => {
	it("lists every section, in order, each going where it says", () => {
		render(<Sections />);

		const links = screen.getAllByRole("link");
		expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
			["Home", "/"],
			["Insights", "/insights"],
			["Portfolio", "/portfolio"],
			["Machines", "/machines"],
			["Activity", "/activity"],
			["Swap", "/swap"],
			["Marketplace", "/marketplace"],
			["Network", "/network"],
		]);
	});
});
