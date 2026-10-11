import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: Home's charts, the background and the globe are stood in for.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./price-chart.tsx", () => ({ PriceChart: () => <div>price chart</div> }));
vi.mock("./pnl-chart.tsx", () => ({ PnlChartView: () => <div>profit chart</div> }));
vi.mock("./globe.tsx", () => ({ Globe: () => <div /> }));

const { renderAt, standIn } = await import("../test/app.tsx");

describe("the account in the corner", () => {
	it("shows the email of a person who signed in without a wallet, not a blank", async () => {
		standIn({ person: "ash@example.com" });
		renderAt("/");
		expect(
			(await screen.findAllByText("ash@example.com", {}, { timeout: 5000 })).length,
		).toBeGreaterThan(0);
	});

	it("opens a panel for them with a way out and a way to link a wallet", async () => {
		standIn({ person: "ash@example.com" });
		renderAt("/");
		fireEvent.click(await screen.findByRole("button", { name: "Your account" }, { timeout: 5000 }));
		expect(
			await screen.findByRole("button", { name: "Sign out" }, { timeout: 5000 }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Link a wallet" })).toBeInTheDocument();
	});
});
