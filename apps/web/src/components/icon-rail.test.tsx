import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

const { IconRail } = await import("./icon-rail.tsx");

describe("the icon rail", () => {
	it("has settings, named for people who cannot see the icon", () => {
		render(<IconRail />);

		expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
	});
});
