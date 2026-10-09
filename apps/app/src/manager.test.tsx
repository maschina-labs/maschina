import { fireEvent, screen, within } from "@testing-library/react";
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

const managerScreen = async () => within(await screen.findByRole("dialog", { name: "Manager" }));

beforeEach(() => {
	localStorage.clear();
});

describe("the manager", () => {
	it("answers on your key, and says what each answer cost", async () => {
		const { requests } = standIn({ aiKey: "wxyz" });
		renderAt("/manager");
		const manager = await managerScreen();
		fireEvent.click(await manager.findByRole("button", { name: "How are my machines doing?" }));
		expect(await manager.findByText("You asked: How are my machines doing?")).toBeInTheDocument();
		expect(manager.getAllByText("1.2¢").length).toBeGreaterThan(0);
		expect(manager.getByText("This conversation: 1.2¢")).toBeInTheDocument();

		const box = manager.getByRole("textbox", { name: "Ask your manager" });
		fireEvent.change(box, { target: { value: "And tomorrow?" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(await manager.findByText("You asked: And tomorrow?")).toBeInTheDocument();
		// The whole conversation goes each time, since nothing is kept between turns.
		const last = requests.filter((each) => each.path === "/v1/manager/messages").at(-1);
		expect(last?.body).toEqual({
			messages: [
				{ role: "you", text: "How are my machines doing?" },
				{ role: "manager", text: "You asked: How are my machines doing?" },
				{ role: "you", text: "And tomorrow?" },
			],
		});
	});

	it("sends you to settings when no key is set", async () => {
		standIn();
		renderAt("/manager");
		const manager = await managerScreen();
		expect(await manager.findByRole("link", { name: "Add it in settings" })).toHaveAttribute(
			"href",
			"/settings",
		);
		expect(manager.getByRole("textbox", { name: "Ask your manager" })).toBeDisabled();
	});

	it("shows why when an answer fails, and leaves it out of the next turn", async () => {
		const { requests } = standIn({ aiKey: "wxyz" });
		renderAt("/manager");
		const manager = await managerScreen();
		const box = await manager.findByRole("textbox", { name: "Ask your manager" });
		await vi.waitFor(() => expect(box).not.toBeDisabled());
		fireEvent.change(box, { target: { value: "am I broke" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(await manager.findByText("Your Anthropic credit has run out")).toBeInTheDocument();
		fireEvent.change(box, { target: { value: "try again" } });
		fireEvent.keyDown(box, { key: "Enter" });
		await manager.findByText("You asked: try again");
		const last = requests.filter((each) => each.path === "/v1/manager/messages").at(-1);
		expect(last?.body).toEqual({
			messages: [
				{ role: "you", text: "am I broke" },
				{ role: "you", text: "try again" },
			],
		});
	});

	it("asks you to connect when nobody is signed in", async () => {
		standIn({ signedIn: false });
		renderAt("/manager");
		const manager = await managerScreen();
		expect(await manager.findByText("Connect to talk to your manager.")).toBeInTheDocument();
	});
});
