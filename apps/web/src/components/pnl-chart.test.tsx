import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("working the chart like a trading chart", () => {
	const points = [
		{ time: 1_000, value: 100_000n },
		{ time: 2_000, value: 300_000n },
		{ time: 3_000, value: 200_000n },
		{ time: 4_000, value: 900_000n },
	];
	const times = () => screen.getAllByText(/^[A-Z][a-z]{2} \d+,/).map((each) => each.textContent);
	const wheel = (target: Element, init: WheelEventInit) =>
		target.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init }));

	it("zooms in time when scrolled on, without scrolling the page, and double click shows it all", async () => {
		render(<PnlChartView points={points} />);
		const chart = screen.getByTestId("pnl-chart");
		const before = times();
		const event = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			deltaY: -400,
			clientX: 200,
			clientY: 100,
		});
		chart.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(times()).not.toEqual(before));
		fireEvent.doubleClick(chart);
		await vi.waitFor(() => expect(times()).toEqual(before));
	});

	it("moves along in time when scrolled sideways, or with shift", async () => {
		render(<PnlChartView points={points} />);
		const chart = screen.getByTestId("pnl-chart");
		const before = times();
		wheel(chart, { deltaY: 300, shiftKey: true, clientX: 200, clientY: 100 });
		await vi.waitFor(() => expect(times()).not.toEqual(before));
	});

	it("zooms the money when scrolled on the scale at the right", async () => {
		render(<PnlChartView points={points} />);
		const chart = screen.getByTestId("pnl-chart");
		const scale = () =>
			screen
				.getAllByText(/^-?\$\d/)
				.map((each) => each.textContent)
				.join();
		const before = scale();
		wheel(chart, { deltaY: 500, clientX: 590, clientY: 100 });
		await vi.waitFor(() => expect(scale()).not.toEqual(before));
	});

	it("moves when dragged", async () => {
		render(<PnlChartView points={points} />);
		const chart = screen.getByTestId("pnl-chart");
		const before = times();
		fireEvent.pointerDown(chart, { clientX: 300, clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(chart, { clientX: 200, clientY: 100, pointerId: 1 });
		fireEvent.pointerUp(chart, { pointerId: 1 });
		await vi.waitFor(() => expect(times()).not.toEqual(before));
	});
});

describe("working the chart from the keyboard", () => {
	it("moves with the arrows, zooms with plus and minus, and zero shows it all", async () => {
		render(
			<PnlChartView
				points={[
					{ time: 1_000, value: 100_000n },
					{ time: 9_000, value: 900_000n },
				]}
			/>,
		);
		const chart = screen.getByRole("application");
		const times = () => screen.getAllByText(/^[A-Z][a-z]{2} \d+,/).map((each) => each.textContent);
		const before = times();
		fireEvent.keyDown(chart, { key: "ArrowRight" });
		await vi.waitFor(() => expect(times()).not.toEqual(before));
		fireEvent.keyDown(chart, { key: "0" });
		await vi.waitFor(() => expect(times()).toEqual(before));
		fireEvent.keyDown(chart, { key: "+" });
		await vi.waitFor(() => expect(times()).not.toEqual(before));
		fireEvent.keyDown(chart, { key: "-" });
		fireEvent.keyDown(chart, { key: "x" });
	});
});
