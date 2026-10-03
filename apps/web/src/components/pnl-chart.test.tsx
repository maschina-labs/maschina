import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PnlChartView } from "./pnl-chart.tsx";

// A test browser lays nothing out, so the chart is given a size to draw into.
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
	configurable: true,
	get: () => 256,
});

describe("profit over time", () => {
	it("says there is nothing to draw before the first sale", () => {
		render(<PnlChartView points={[]} />);
		expect(screen.getByText(/NO SALES YET/)).toBeInTheDocument();
	});

	it("draws one smooth line through each sale, in dollars, with zero dashed", () => {
		const { container } = render(
			<PnlChartView
				points={[
					{ time: 100, value: 630_000n },
					{ time: 200, value: -370_000n },
					{ time: 300, value: 1_100_000n },
				]}
			/>,
		);
		expect(screen.getByRole("img", { name: "Realized profit over time" })).toBeInTheDocument();
		// Curves, never corners.
		const path = container.querySelector("path")?.getAttribute("d") ?? "";
		expect(path).toMatch(/^M[\d.]+,[\d.]+ C/);
		expect(path).not.toContain("L");
		expect(container.querySelector('line[stroke-dasharray="3 4"]')).not.toBeNull();
		// The latest result, where the eye lands first.
		expect(screen.getAllByText("$1.10").length).toBeGreaterThan(0);
		// No trading chart library is involved.
		expect(container.querySelector(".tv-lightweight-charts")).toBeNull();
	});

	it("keeps the later of two sales in the same second", () => {
		render(
			<PnlChartView
				points={[
					{ time: 100, value: 100_000n },
					{ time: 100, value: 250_000n },
				]}
			/>,
		);
		expect(screen.getAllByText("$0.25").length).toBeGreaterThan(0);
	});
});
