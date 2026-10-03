import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: the background, the charts and the globe are stood in for.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./components/globe.tsx", () => ({ Globe: () => <div /> }));
vi.mock("./components/price-chart.tsx", () => ({ PriceChart: () => <div>price chart</div> }));
vi.mock("./components/pnl-chart.tsx", () => ({ PnlChartView: () => <div>profit chart</div> }));

const { renderAt, standIn } = await import("./test/app.tsx");

const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123";
const settingsScreen = async () => within(await screen.findByRole("dialog", { name: "Settings" }));

beforeEach(() => {
	localStorage.clear();
});

describe("the AI key in settings", () => {
	it("takes a key, then shows only its last four", async () => {
		const { requests } = standIn();
		renderAt("/settings");
		const settings = await settingsScreen();
		fireEvent.change(await settings.findByLabelText("Anthropic key"), { target: { value: KEY } });
		fireEvent.click(settings.getByRole("button", { name: "Save" }));
		expect(await settings.findByText("Anthropic key ending 0123")).toBeInTheDocument();
		expect(settings.queryByLabelText("Anthropic key")).not.toBeInTheDocument();
		expect(requests).toContainEqual({ method: "PUT", path: "/v1/manager/key", body: { key: KEY } });
		// The key never lands anywhere the browser keeps.
		expect(JSON.stringify({ ...localStorage })).not.toContain("sk-ant");
	});

	it("says why when Anthropic refuses the key, and keeps the field", async () => {
		standIn();
		renderAt("/settings");
		const settings = await settingsScreen();
		fireEvent.change(await settings.findByLabelText("Anthropic key"), {
			target: { value: "sk-ant-refused-0000000000000000000000" },
		});
		fireEvent.click(settings.getByRole("button", { name: "Save" }));
		expect(await settings.findByRole("alert")).toHaveTextContent(
			"Anthropic did not accept that key",
		);
		expect(settings.getByLabelText("Anthropic key")).toBeInTheDocument();
	});

	it("replaces and removes a key already set", async () => {
		standIn({ aiKey: "wxyz" });
		renderAt("/settings");
		const settings = await settingsScreen();
		expect(await settings.findByText("Anthropic key ending wxyz")).toBeInTheDocument();
		fireEvent.click(settings.getByRole("button", { name: "Replace" }));
		expect(settings.getByLabelText("Anthropic key")).toBeInTheDocument();
		fireEvent.change(settings.getByLabelText("Anthropic key"), { target: { value: KEY } });
		fireEvent.click(settings.getByRole("button", { name: "Save" }));
		expect(await settings.findByText("Anthropic key ending 0123")).toBeInTheDocument();
		fireEvent.click(settings.getByRole("button", { name: "Remove" }));
		await waitFor(() => expect(settings.getByLabelText("Anthropic key")).toBeInTheDocument());
	});

	it("asks you to connect first when nobody is signed in", async () => {
		standIn({ signedIn: false });
		renderAt("/settings");
		const settings = await settingsScreen();
		expect(
			await settings.findByText("Connect to give the manager your Anthropic key."),
		).toBeInTheDocument();
	});
});
