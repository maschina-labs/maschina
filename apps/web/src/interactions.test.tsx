import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: the background, the charts and the globe are stood in for.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./components/price-chart.tsx", () => ({ PriceChart: () => <div /> }));
vi.mock("./components/pnl-chart.tsx", () => ({ PnlChartView: () => <div /> }));
vi.mock("./components/globe.tsx", () => ({ Globe: () => <div /> }));

const { MACHINE_ID, renderAt, standIn } = await import("./test/app.tsx");
const { Broken, OfflineBanner, SessionEnded } = await import("./components/system.tsx");

const home = () => screen.findByRole("region", { name: "Home" });

beforeEach(() => {
	localStorage.clear();
	standIn();
});

describe("moving between sections", () => {
	it("a mouse dragged sideways moves a page; a small press is still a click", async () => {
		const { router } = renderAt("/");
		const page = await home();
		fireEvent.pointerDown(page, { pointerType: "mouse", button: 0, clientX: 400 });
		fireEvent.pointerUp(page, { pointerType: "mouse", clientX: 395 });
		expect(router.state.location.pathname).toBe("/");
		fireEvent.pointerDown(page, { pointerType: "mouse", button: 0, clientX: 400 });
		fireEvent.pointerUp(page, { pointerType: "mouse", clientX: 100 });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/insights"));
	});

	it("a finger swiped sideways moves a page back, round to the last", async () => {
		const { router } = renderAt("/");
		const page = await home();
		const at = (x: number, y = 300) => ({
			touches: [{ clientX: x, clientY: y }],
			changedTouches: [{ clientX: x, clientY: y }],
		});
		fireEvent.touchStart(page, at(100));
		fireEvent.touchMove(page, at(200));
		fireEvent.touchMove(page, at(320));
		fireEvent.touchEnd(page, at(320));
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/network"));
	});

	it("a finger moving up and down scrolls instead", async () => {
		const { router } = renderAt("/");
		const page = await home();
		const at = (x: number, y: number) => ({
			touches: [{ clientX: x, clientY: y }],
			changedTouches: [{ clientX: x, clientY: y }],
		});
		fireEvent.touchStart(page, at(100, 300));
		fireEvent.touchMove(page, at(105, 150));
		fireEvent.touchEnd(page, at(105, 100));
		expect(router.state.location.pathname).toBe("/");
	});

	it("one trackpad swipe and its glide move one page, never two", async () => {
		const { router } = renderAt("/");
		const page = await home();
		// The swipe, then the glide it leaves behind: jittery, but dying away.
		for (const deltaX of [40, 60, 50, 38, 30, 31, 22, 18, 19, 12, 8, 5, 3, 2]) {
			fireEvent.wheel(page, { deltaX, deltaY: 0 });
		}
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/insights"));
		await new Promise((done) => setTimeout(done, 700));
		expect(router.state.location.pathname).toBe("/insights");
	});

	it("an up and down scroll on a trackpad is not a page move", async () => {
		const { router } = renderAt("/");
		const page = await home();
		fireEvent.wheel(page, { deltaX: 5, deltaY: 120 });
		expect(router.state.location.pathname).toBe("/");
	});

	it("the left arrow goes back", async () => {
		const { router } = renderAt("/insights");
		await screen.findByRole("region", { name: "Insights" });
		fireEvent.keyDown(document.body, { key: "ArrowLeft" });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
	});
});

describe("closing a screen", () => {
	it("Escape takes you back to the section underneath", async () => {
		const { router } = renderAt(`/machines/${MACHINE_ID}`);
		await screen.findByRole("dialog", { name: "Machine" });
		fireEvent.keyDown(window, { key: "Escape" });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
	});

	it("so does the back button", async () => {
		const { router } = renderAt("/papers");
		await screen.findByRole("dialog", { name: "Papers" });
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
	});

	it("a tile opens its screen", async () => {
		const { router } = renderAt("/");
		const page = await home();
		fireEvent.click(await within(page).findByRole("button", { name: "In the vault" }));
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/vault"));
	});
});

describe("your account", () => {
	it("copies your address, and disconnects", async () => {
		const writeText = vi.fn(async () => undefined);
		Object.assign(navigator, { clipboard: { writeText } });
		renderAt("/");
		await home();
		fireEvent.click(await screen.findByRole("button", { name: "Account" }));
		fireEvent.click(await screen.findByRole("button", { name: /Copy/ }));
		expect(writeText).toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
	});
});

describe("the stop switch", () => {
	it("when it is on, says so across the top: why, and that money can still come home", async () => {
		standIn({ halt: "upgrading the signer" });
		renderAt("/");
		const banner = await screen.findByRole("alert");
		expect(banner).toHaveTextContent(/paused/i);
		expect(banner).toHaveTextContent("upgrading the signer");
		expect(banner).toHaveTextContent(/withdraw/i);
	});

	it("says nothing when it is off", async () => {
		standIn();
		renderAt("/");
		await home();
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("when things go wrong", () => {
	it("a broken screen says what broke, and offers to try again", () => {
		const retry = vi.fn();
		render(<Broken detail="The deck could not be drawn" retry={retry} />);
		expect(screen.getByText("The deck could not be drawn")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalled();
	});

	it("an ended session offers to connect again", () => {
		const connect = vi.fn();
		render(<SessionEnded onConnect={connect} />);
		fireEvent.click(screen.getByRole("button", { name: "Connect again" }));
		expect(connect).toHaveBeenCalled();
	});

	it("losing the connection says so, and clears when it is back", () => {
		render(<OfflineBanner />);
		expect(screen.queryByRole("status")).toBeNull();
		act(() => {
			window.dispatchEvent(new Event("offline"));
		});
		expect(screen.getByRole("status")).toHaveTextContent(/Offline/);
		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		expect(screen.queryByRole("status")).toBeNull();
	});
});
