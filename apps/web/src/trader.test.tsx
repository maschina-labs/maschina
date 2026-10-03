import { fireEvent, screen, within } from "@testing-library/react";
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

const { renderAt, standIn, TRADER_RUN } = await import("./test/app.tsx");

// The panel waits on three answers in a row (who is signed in, the key, then the run), which a busy CI
// machine takes well past the usual second to give.
const WAIT = { timeout: 8_000 };
vi.setConfig({ testTimeout: 20_000 });
const panel = async () => within(await screen.findByRole("region", { name: "Paper trader" }, WAIT));

beforeEach(() => {
	localStorage.clear();
});

describe("the paper trader", () => {
	it("starts with the cash given, then shows its run", async () => {
		const { requests } = standIn({ aiKey: "wxyz" });
		renderAt("/manager");
		const trader = await panel();
		fireEvent.change(await trader.findByLabelText("Paper cash", {}, WAIT), {
			target: { value: "25" },
		});
		fireEvent.click(trader.getByRole("button", { name: "Start paper trading" }));
		expect(await trader.findByRole("button", { name: "Stop" }, WAIT)).toBeInTheDocument();
		expect(requests).toContainEqual({
			method: "POST",
			path: "/v1/manager/trader",
			body: { cashUsd: 25 },
		});
		expect(trader.getAllByText("$25.00").length).toBeGreaterThan(0);
	});

	it("shows worth against the start, what it holds, and every line of what it did", async () => {
		standIn({ aiKey: "wxyz", trader: TRADER_RUN });
		renderAt("/manager");
		const trader = await panel();
		expect(await trader.findByText("+2.05%", {}, WAIT)).toBeInTheDocument();
		expect(trader.getByText("4 looks")).toBeInTheDocument();
		const holding = within(trader.getByRole("list", { name: "Holding" }));
		expect(holding.getByText("$10.00 → $10.52")).toBeInTheDocument();
		expect(holding.getByText("$5.00 → ?")).toBeInTheDocument();
		expect(trader.getByText(/the trade would move the price 5%/)).toBeInTheDocument();
		expect(trader.getByText(/think · 3\.1¢/)).toBeInTheDocument();
	});

	it("stops, and offers a new run", async () => {
		standIn({ aiKey: "wxyz", trader: TRADER_RUN });
		renderAt("/manager");
		const trader = await panel();
		fireEvent.click(await trader.findByRole("button", { name: "Stop" }, WAIT));
		expect(
			await trader.findByText("Stopped. Start again for a new run.", {}, WAIT),
		).toBeInTheDocument();
		expect(trader.getByRole("button", { name: "Start paper trading" })).toBeInTheDocument();
	});

	it("says why it paused, and that its first look is coming on a fresh run", async () => {
		standIn({
			aiKey: "wxyz",
			trader: { ...TRADER_RUN, status: "paused", pausedBecause: "the book is down 30%", log: [] },
		});
		renderAt("/manager");
		const trader = await panel();
		expect(await trader.findByText("Paused: the book is down 30%", {}, WAIT)).toBeInTheDocument();
		expect(trader.getByText("Its first look is on the way.")).toBeInTheDocument();
	});

	it("will not start on less than five dollars", async () => {
		standIn({ aiKey: "wxyz" });
		renderAt("/manager");
		const trader = await panel();
		fireEvent.change(await trader.findByLabelText("Paper cash", {}, WAIT), {
			target: { value: "2" },
		});
		expect(trader.getByRole("button", { name: "Start paper trading" })).toBeDisabled();
	});
});
