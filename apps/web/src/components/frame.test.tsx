import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The rails and the wallet button talk to the API; the frame is tested for where things sit.
vi.mock("./rails.tsx", () => ({
	RightRail: () => <aside aria-label="Right" />,
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));
vi.mock("./sections.tsx", () => ({ Sections: () => <nav aria-label="Sections" /> }));
vi.mock("./wallet-button.tsx", () => ({
	WalletButton: () => <button type="button">Connect</button>,
}));

const { Frame } = await import("./frame.tsx");

describe("the terminal frame", () => {
	it("has a header, the page, and one sidebar on the right", () => {
		render(
			<Frame>
				<p>the page</p>
			</Frame>,
		);

		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("complementary", { name: "Right" })).toBeInTheDocument();
		expect(screen.getByRole("main")).toHaveTextContent("the page");
	});

	it("can show the header alone, with the page straight on the field", () => {
		render(<Frame sides={false}>{null}</Frame>);

		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
	});

	it("names Maschina in the header", () => {
		render(<Frame>{null}</Frame>);

		expect(screen.getByRole("banner")).toHaveTextContent("MASCHINA");
	});

	it("takes you home from the wordmark, and carries the sections", () => {
		render(<Frame>{null}</Frame>);

		expect(screen.getByRole("link", { name: "MASCHINA" })).toHaveAttribute("href", "/");
		expect(screen.getByRole("banner")).toContainElement(
			screen.getByRole("navigation", { name: "Sections" }),
		);
	});
});
