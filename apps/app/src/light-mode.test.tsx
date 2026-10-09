import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: the background, the charts and the globe are stood in for.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./components/price-chart.tsx", () => ({ PriceChart: () => <div>price chart</div> }));
vi.mock("./components/pnl-chart.tsx", () => ({ PnlChartView: () => <div>profit chart</div> }));
vi.mock("./components/globe.tsx", () => ({ Globe: () => <div /> }));

const { renderAt, standIn } = await import("./test/app.tsx");

beforeEach(() => {
	localStorage.clear();
	delete document.documentElement.dataset["mode"];
});

describe("the page's palette", () => {
	it("turns over for light mode, from one attribute on the page", async () => {
		standIn();
		localStorage.setItem("maschina.theme", "light");
		renderAt("/");
		await screen.findAllByText(/Home/);
		expect(document.documentElement.dataset["mode"]).toBe("light");
	});

	it("stays dark in dark mode", async () => {
		standIn();
		localStorage.setItem("maschina.theme", "dark");
		renderAt("/");
		await screen.findAllByText(/Home/);
		expect(document.documentElement.dataset["mode"]).toBe("dark");
	});
});
