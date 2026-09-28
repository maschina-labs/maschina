import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));
vi.mock("../lib/session.ts", () => ({
	useSession: () => ({
		data: { ownerId: "o", walletAddress: "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR" },
	}),
}));

const { Settings } = await import("./settings.tsx");

describe("settings", () => {
	it("shows the connected wallet", () => {
		render(<Settings />);

		expect(screen.getByText("8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR")).toBeInTheDocument();
	});

	it("links to alerts and keys", () => {
		render(<Settings />);

		expect(screen.getByRole("link", { name: "ALERTS →" })).toHaveAttribute(
			"href",
			"/settings/alerts",
		);
	});

	it("states plainly that paper is free", () => {
		render(<Settings />);

		expect(screen.getByText("FREE, AND AS MANY AS YOU LIKE")).toBeInTheDocument();
	});
});
