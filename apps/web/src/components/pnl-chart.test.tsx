import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const setData = vi.fn();
vi.mock("lightweight-charts", () => ({
	ColorType: { Solid: "solid" },
	LineSeries: "line",
	LineStyle: { Dashed: 2 },
	createChart: () => ({
		addSeries: () => ({ setData, createPriceLine: vi.fn() }),
		timeScale: () => ({ fitContent: vi.fn() }),
		remove: vi.fn(),
	}),
}));

const { PnlChartView } = await import("./pnl-chart.tsx");

describe("profit over time", () => {
	it("says there is nothing to draw before the first sale", () => {
		render(<PnlChartView points={[]} />);

		expect(screen.getByText(/NO SALES YET/)).toBeInTheDocument();
	});

	it("draws each sale in dollars", () => {
		render(
			<PnlChartView
				points={[
					{ time: 100, value: 630_000n },
					{ time: 200, value: -370_000n },
				]}
			/>,
		);

		expect(setData).toHaveBeenCalledWith([
			{ time: 100, value: 0.63 },
			{ time: 200, value: -0.37 },
		]);
	});
});
