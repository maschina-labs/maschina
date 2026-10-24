import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketChart from "./market-chart.tsx";

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
	stream: vi.fn(),
	setData: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
	stop: vi.fn(),
	line: vi.fn(() => ({})),
	removeLine: vi.fn(),
}));
vi.mock("./market-candles.ts", () => ({ fetchCandles: mocks.fetch, streamCandles: mocks.stream }));
vi.mock("lightweight-charts", () => ({
	ColorType: { Solid: "solid" },
	CandlestickSeries: "candles",
	createChart: (
		_holder: HTMLElement,
		options: { timeScale: { fixLeftEdge: boolean; fixRightEdge: boolean } },
	) => {
		expect(options.timeScale).toMatchObject({ fixLeftEdge: true, fixRightEdge: true });
		return {
			addSeries: () => ({
				setData: mocks.setData,
				update: mocks.update,
				applyOptions: vi.fn(),
				createPriceLine: mocks.line,
				removePriceLine: mocks.removeLine,
				priceToCoordinate: (price: number) => 600 - price * 3,
			}),
			timeScale: () => ({ fitContent: vi.fn() }),
			remove: mocks.remove,
		};
	},
}));
const labels = {
	loading: "Loading prices",
	unavailable: "Prices unavailable",
	connected: "Feed connected",
	disconnected: "Feed disconnected",
};
const candle = { time: 100, open: 140, high: 145, low: 138, close: 142, volume: 20 };
beforeEach(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			disconnect() {}
		},
	);
	vi.clearAllMocks();
	mocks.stream.mockReturnValue(mocks.stop);
});
describe("public SOL chart", () => {
	it("updates band bounds when its center moves and width changes", async () => {
		mocks.fetch.mockResolvedValue([candle]);
		const band = {
			width: "Width",
			center: "Move band",
			inside: "Inside",
			outside: "Outside",
			lower: "Low",
			upper: "High",
			reset: "Reset",
		};
		const { rerender } = render(<MarketChart {...labels} labels={band} bandWidth={2.5} />);
		await screen.findByText("Inside");
		expect(mocks.line).toHaveBeenCalledWith(expect.objectContaining({ price: 142 * 0.975 }));
		fireEvent.change(screen.getByRole("slider"), { target: { value: "5" } });
		expect(screen.getByText("Outside")).toBeInTheDocument();
		rerender(<MarketChart {...labels} labels={band} bandWidth={5} />);
		expect(mocks.line).toHaveBeenCalledWith(expect.objectContaining({ price: 142 * 1.05 * 0.95 }));
		fireEvent.click(screen.getByRole("button", { name: "Reset" }));
		expect(screen.getByText("Inside")).toBeInTheDocument();
	});

	it("loads real feed data, distinguishes history from live, and closes the stream", async () => {
		mocks.fetch.mockResolvedValue([candle]);
		const { unmount } = render(<MarketChart {...labels} />);
		await screen.findByText("Feed disconnected");
		expect(mocks.fetch).toHaveBeenCalledWith("SOLUSDT", "15m", 160);
		expect(mocks.setData).toHaveBeenCalledWith([candle]);
		expect(screen.getByText("142.00", { exact: false })).toBeInTheDocument();
		act(() => mocks.stream.mock.calls[0]?.[4](true));
		expect(screen.getByText("Feed connected")).toBeInTheDocument();
		unmount();
		expect(mocks.stop).toHaveBeenCalledOnce();
		expect(mocks.remove).toHaveBeenCalledOnce();
	});
	it("shows an unavailable state without inventing prices when history fails", async () => {
		mocks.fetch.mockRejectedValue(new Error("network"));
		render(<MarketChart {...labels} />);
		await screen.findByText("Prices unavailable");
		expect(mocks.setData).not.toHaveBeenCalled();
		expect(mocks.stream).not.toHaveBeenCalled();
	});
	it("does not open a stream after the component unmounts during loading", async () => {
		let resolve: (value: (typeof candle)[]) => void = () => {};
		mocks.fetch.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const { unmount } = render(<MarketChart {...labels} />);
		unmount();
		await act(async () => {
			resolve([candle]);
		});
		await waitFor(() => expect(mocks.stream).not.toHaveBeenCalled());
	});
});
