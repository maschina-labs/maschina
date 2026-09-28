import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		activeProps: _,
		...rest
	}: {
		children: React.ReactNode;
		to: string;
		activeProps?: unknown;
	}) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useRouter: () => ({ options: { context: { api: {} } } }),
	useSearch: () => ({}),
}));
vi.mock("../lib/session.ts", () => ({ useSession: () => ({ data: null }) }));
vi.mock("../lib/machines.ts", () => ({ useMachines: () => ({ data: [] }) }));
vi.mock("./portfolio.tsx", () => ({ useActivity: () => [] }));

const { LeftRail } = await import("./rails.tsx");

describe("the left side", () => {
	it("has a rail with machines, docs and settings", () => {
		render(<LeftRail />);

		expect(screen.getByRole("button", { name: "Your machines" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
			"href",
			"https://docs.maschina.dev",
		);
		expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
	});

	it("opens and closes the machines panel from the rail", () => {
		render(<LeftRail />);

		expect(screen.getByRole("complementary", { name: "Left" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Your machines" }));
		expect(screen.queryByRole("complementary", { name: "Left" })).not.toBeInTheDocument();
	});
});
