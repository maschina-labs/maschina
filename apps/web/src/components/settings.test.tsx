import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
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

	it("switches an alert on and off", () => {
		render(<Settings />);

		const daily = screen.getByRole("button", { name: /A DAILY SUMMARY/ });
		expect(daily).toHaveAttribute("aria-pressed", "false");
		fireEvent.click(daily);
		expect(daily).toHaveAttribute("aria-pressed", "true");
	});

	it("states plainly that paper is free", () => {
		render(<Settings />);

		expect(screen.getByText("FREE, AND AS MANY AS YOU LIKE")).toBeInTheDocument();
	});
});
