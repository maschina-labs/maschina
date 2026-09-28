import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		onClick,
	}: {
		children: React.ReactNode;
		to: string;
		onClick?: () => void;
	}) => (
		<a href={to} onClick={onClick}>
			{children}
		</a>
	),
}));

const { MobileMenu } = await import("./mobile-menu.tsx");

describe("the phone menu", () => {
	it("opens a sheet with every page, docs and settings, and closes on a choice", () => {
		render(<MobileMenu />);

		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const menu = screen.getByRole("navigation", { name: "Menu" });
		expect(menu).toHaveTextContent("Terminal");
		expect(menu).toHaveTextContent("Network");
		expect(menu).toHaveTextContent("Settings");

		fireEvent.click(screen.getByRole("link", { name: "Portfolio" }));
		expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
	});
});
