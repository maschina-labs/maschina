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

describe("closing a screen", () => {
	const shown = (dialog: HTMLElement) =>
		(dialog.querySelector(":scope > div:last-child") as HTMLElement | null)?.style.opacity;

	it("a screen reached while another fades shows whole, never as an invisible layer over everything", async () => {
		const { router } = renderAt("/settings/alerts");
		await screen.findByRole("dialog", { name: "Alerts" });
		// Alerts starts to close, and the address moves on to Settings before the fade is done: what a
		// step back through history does.
		fireEvent.keyDown(window, { key: "Escape" });
		await router.navigate({ to: "/settings" });
		const settings = await screen.findByRole("dialog", { name: "Settings" });
		await vi.waitFor(() => expect(shown(settings)).toBe("1"));
		expect(settings.style.pointerEvents).toBe("auto");
	});

	it("lets every click through the moment it starts to close", async () => {
		renderAt("/settings");
		const settings = await screen.findByRole("dialog", { name: "Settings" });
		fireEvent.keyDown(window, { key: "Escape" });
		await vi.waitFor(() => expect(settings.style.pointerEvents).toBe("none"));
	});
});

describe("checking a trade on chain", () => {
	it("links each trade to the explorer the owner chose, Solscan unless they chose another", async () => {
		localStorage.removeItem("maschina.explorer");
		renderAt(`/machines/${MACHINE_ID}`);
		const link = await screen.findByRole("link", { name: "View on Solscan" });
		expect(link).toHaveAttribute(
			"href",
			"https://solscan.io/tx/5sigTwoxRealLookingButMadeUpForTheTestsOnly",
		);
		localStorage.setItem("maschina.explorer", "solana");
		window.dispatchEvent(new Event("maschina:explorer"));
		expect(await screen.findByRole("link", { name: "View on Solana Explorer" })).toHaveAttribute(
			"href",
			"https://explorer.solana.com/tx/5sigTwoxRealLookingButMadeUpForTheTestsOnly",
		);
	});
});

describe("the account sidebar", () => {
	const OTHER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
	const openAccount = async () => {
		renderAt("/");
		await home();
		// Which sidebar is open outlives a test, so each one starts with them all closed.
		fireEvent.keyDown(window, { key: "Escape" });
		fireEvent.click(await screen.findByRole("button", { name: "Account" }));
		return within(
			(await screen.findByText(/^Showing (live|paper) money$/)).closest("aside") as HTMLElement,
		);
	};

	it("shows what your money is doing, and remembers this wallet", async () => {
		const account = await openAccount();
		expect(account.getByText("Showing live money")).toBeInTheDocument();
		expect(account.getByText("At work")).toBeInTheDocument();
		expect(account.getByText(/1 of 1 machine running/)).toBeInTheDocument();
		expect(account.getByText("AI key")).toBeInTheDocument();
		await vi.waitFor(() =>
			expect(localStorage.getItem("maschina.wallets") ?? "").toContain("8GTgV1msc"),
		);
	});

	it("lists another wallet used here, forgets it, and switches by asking the wallet", async () => {
		localStorage.setItem(
			"maschina.wallets",
			JSON.stringify([{ address: OTHER, lastUsed: "2026-10-03T10:00:00.000Z" }]),
		);
		const { requests } = standIn();
		const account = await openAccount();
		expect(account.getByText("3KnH…bEQF")).toBeInTheDocument();
		fireEvent.click(account.getByRole("button", { name: "Switch wallet" }));
		// It asks first, and nothing is signed out while it asks.
		const picker = await screen.findByRole("dialog", { name: "Choose a wallet" });
		expect(requests.some((each) => each.path === "/v1/auth/sign-out")).toBe(false);
		// Closing it leaves you signed in as you were.
		fireEvent.click(within(picker).getByRole("button", { name: "Close wallets" }));
		await vi.waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Choose a wallet" })).toBeNull(),
		);
		expect(account.getByText("Showing live money")).toBeInTheDocument();
		expect(requests.some((each) => each.path === "/v1/auth/sign-out")).toBe(false);
	});

	it("forgets a wallet it no longer needs", async () => {
		localStorage.setItem(
			"maschina.wallets",
			JSON.stringify([{ address: OTHER, lastUsed: "2026-10-03T10:00:00.000Z" }]),
		);
		const account = await openAccount();
		fireEvent.click(account.getByRole("button", { name: "Forget 3KnH…bEQF" }));
		await vi.waitFor(() => expect(account.queryByText("3KnH…bEQF")).not.toBeInTheDocument());
	});

	it("opens and closes from the same account button", async () => {
		renderAt("/");
		await home();
		fireEvent.keyDown(window, { key: "Escape" });
		const button = (
			await screen.findAllByRole("button", { name: "Your account" })
		)[0] as HTMLElement;
		fireEvent.click(button);
		const panel = (await screen.findByText(/^Showing (live|paper) money$/)).closest("aside");
		await vi.waitFor(() => expect(panel?.className).toContain("translate-x-0"));
		fireEvent.click(button);
		await vi.waitFor(() => expect(panel?.className).not.toContain("translate-x-0"));
	});

	it("takes you to settings, alerts and the papers", async () => {
		const account = await openAccount();
		fireEvent.click(account.getByRole("button", { name: "Alerts" }));
		await vi.waitFor(() => expect(window.location.pathname).toBeDefined());
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
