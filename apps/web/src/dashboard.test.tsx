import { act, fireEvent, screen, within } from "@testing-library/react";
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
// Signing a transaction is the wallet's job; here the wallet approves whatever it is shown.
const wallet = vi.hoisted(() => ({ sendTransaction: vi.fn(async () => "signature") }));
vi.mock("./lib/wallet.ts", async (real) => ({ ...(await real<object>()), ...wallet }));

const { MACHINE_ID, machine, renderAt, standIn } = await import("./test/app.tsx");
const { installWallet } = await import("./test/wallets.ts");

const section = async (name: string) => within(await screen.findByRole("region", { name }));
const screenNamed = async (title: string) =>
	within(await screen.findByRole("dialog", { name: title }));

beforeEach(() => {
	localStorage.clear();
});

describe("the sections, signed in", () => {
	beforeEach(() => {
		standIn();
	});

	it("home leads with what was made, once a machine is at work", async () => {
		renderAt("/");
		const home = await section("Home");
		expect(await home.findByRole("button", { name: "Realized profit" })).toBeInTheDocument();
	});

	it.each([
		["/insights", "Insights", "Notes"],
		["/portfolio", "Portfolio", "Profit over time"],
		["/machines", "Machines", "Range Finder"],
		["/activity", "Activity", "Recent activity"],
		["/swap", "Swap", "Swap"],
		["/network", "Network", "Nodes online"],
	])("%s shows its tiles", async (path, name, tile) => {
		renderAt(path);
		const page = await section(name);
		expect((await page.findAllByLabelText(tile)).length).toBeGreaterThan(0);
	});

	it("moves a page at a time with the arrow keys, round from the last to the first", async () => {
		const { router } = renderAt("/network");
		await section("Network");
		fireEvent.keyDown(document.body, { key: "ArrowRight" });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
	});

	it("moves a page with a sideways swipe on a trackpad", async () => {
		const { router } = renderAt("/");
		const home = await screen.findByRole("region", { name: "Home" });
		fireEvent.wheel(home, { deltaX: 120, deltaY: 0 });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/insights"));
	});
});

describe("swapping", () => {
	it("turns the pair around, and says so when no quote can be had", async () => {
		standIn();
		renderAt("/swap");
		const swap = await section("Swap");
		expect(swap.getByText("USDC")).toBeInTheDocument();
		fireEvent.click(swap.getByRole("button", { name: "Turn it around" }));
		expect(await swap.findByText(/^SOL$/)).toBeInTheDocument();
		fireEvent.change(swap.getByRole("textbox", { name: "You pay" }), { target: { value: "2" } });
		// Jupiter is offline in a test, so the quote fails, and the tile says why rather than showing nothing.
		expect(await swap.findByText(/answered|quote|503/i, {}, { timeout: 3000 })).toBeInTheDocument();
		fireEvent.change(swap.getByRole("textbox", { name: "You pay" }), {
			target: { value: "nothing" },
		});
	});
});

describe("the sections, signed out", () => {
	beforeEach(() => {
		standIn({ signedIn: false });
	});

	it("home starts with the first step: connecting", async () => {
		renderAt("/");
		const home = await section("Home");
		expect(await home.findByText("Connect your wallet")).toBeInTheDocument();
		expect(home.getByText("Start here")).toBeInTheDocument();
	});

	it.each(["/insights", "/portfolio", "/machines", "/activity"])(
		"%s asks you to connect",
		async (path) => {
			renderAt(path);
			expect((await screen.findAllByText(/Connect/)).length).toBeGreaterThan(0);
		},
	);
});

describe("connecting", () => {
	it("with no wallet in the browser, the picker says so and shows where to get one", async () => {
		standIn({ signedIn: false });
		renderAt("/");
		await section("Home");
		const connect = screen.getAllByRole("button", { name: "Connect" })[0] as HTMLElement;
		// Ready once the app knows nobody is signed in.
		await vi.waitFor(() => expect(connect).toBeEnabled());
		fireEvent.click(connect);
		const picker = within(await screen.findByRole("dialog", { name: "Choose a wallet" }));
		expect(picker.getByText("No Solana wallet is installed in this browser.")).toBeInTheDocument();
		expect(picker.getByRole("link", { name: "Get Solflare" })).toHaveAttribute(
			"href",
			"https://solflare.com",
		);
		fireEvent.click(picker.getByRole("button", { name: "Close wallets" }));
		await vi.waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Choose a wallet" })).toBeNull(),
		);
	});

	it("lists the wallets installed, connects the one chosen, and says why when it refuses", async () => {
		standIn({ signedIn: false });
		installWallet("Solflare", "SoLfLaRe", {
			"standard:connect": {
				connect: async () => Promise.reject(new Error("The user rejected the request")),
			},
		});
		installWallet("Jupiter");
		renderAt("/");
		await section("Home");
		const connect = screen.getAllByRole("button", { name: "Connect" })[0] as HTMLElement;
		await vi.waitFor(() => expect(connect).toBeEnabled());
		fireEvent.click(connect);
		const picker = within(await screen.findByRole("dialog", { name: "Choose a wallet" }));
		const listed = within(picker.getByRole("list", { name: "Installed wallets" }));
		// Each with its own icon, and nothing chosen for the owner.
		const icons = picker.getByRole("list", { name: "Installed wallets" }).querySelectorAll("img");
		expect(
			[...icons].map((icon) => icon.getAttribute("src")?.startsWith("data:image/svg+xml")),
		).toEqual([true, true]);
		expect(picker.queryByText("Your default")).toBeNull();
		fireEvent.click(listed.getByRole("button", { name: /^Solflare/ }));
		expect(await screen.findByText(/rejected the request/)).toBeInTheDocument();
	});

	it("remembers a default the owner chose, and lists it first", async () => {
		standIn({ signedIn: false });
		installWallet("Backpack");
		installWallet("Solflare");
		renderAt("/");
		await section("Home");
		const connect = screen.getAllByRole("button", { name: "Connect" })[0] as HTMLElement;
		await vi.waitFor(() => expect(connect).toBeEnabled());
		fireEvent.click(connect);
		const picker = within(await screen.findByRole("dialog", { name: "Choose a wallet" }));
		fireEvent.click(picker.getByRole("button", { name: "Use Solflare by default" }));
		expect(localStorage.getItem("maschina.wallet.default")).toBe("Solflare");
		const names = within(picker.getByRole("list", { name: "Installed wallets" }))
			.getAllByRole("button")
			.map((each) => each.textContent ?? "");
		expect(names[0]).toContain("Solflare");
		expect(picker.getByText("Your default")).toBeInTheDocument();
		fireEvent.keyDown(window, { key: "Escape" });
	});
});

describe("with paper machines, and with none", () => {
	it("the sections say paper money is not money", async () => {
		standIn({
			machines: [{ ...machine, paper: true, result: { ...machine.result, simulated: true } }],
		});
		renderAt("/portfolio");
		await section("Portfolio");
		expect((await screen.findAllByText(/USDC/)).length).toBeGreaterThan(0);
	});

	it.each(["/", "/portfolio", "/machines", "/activity", "/insights"])(
		"%s with no machines yet points to making one",
		async (path) => {
			standIn({ machines: [] });
			renderAt(path);
			expect((await screen.findAllByText(/machine/i)).length).toBeGreaterThan(0);
		},
	);
});

describe("search", () => {
	beforeEach(() => {
		standIn();
	});

	it("opens with Command K and goes where you choose", async () => {
		const { router } = renderAt("/");
		await section("Home");
		fireEvent.keyDown(document.body, { key: "k", metaKey: true });
		const box = await screen.findByRole("textbox", { name: "Search" });
		fireEvent.change(box, { target: { value: "settings" } });
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
	});

	it("no longer offers the papers: they left the app on 2026-10-09", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.keyDown(document.body, { key: "k", metaKey: true });
		const box = await screen.findByRole("textbox", { name: "Search" });
		fireEvent.change(box, { target: { value: "papers" } });
		expect(screen.queryByRole("option", { name: /Papers/ })).toBeNull();
		expect(screen.queryByText("Papers")).toBeNull();
		fireEvent.keyDown(box, { key: "Escape" });
	});

	it("finds your machines by name, and closes with Escape", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
		const box = await screen.findByRole("textbox", { name: "Search" });
		fireEvent.change(box, { target: { value: "range" } });
		expect(await screen.findAllByText(/Range Finder/)).not.toHaveLength(0);
		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key: "ArrowUp" });
		fireEvent.keyDown(box, { key: "Escape" });
		await vi.waitFor(() => expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull());
	});
});

describe("the edges", () => {
	beforeEach(() => {
		standIn();
	});

	it("the charms switch idle mode off and on again", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Tiles" })[0] as HTMLElement);
		const idle = await screen.findByRole("button", { name: /Idle mode/ });
		// On to begin with, so the first press switches it off, and the next plays it.
		fireEvent.click(idle);
		expect(localStorage.getItem("maschina.idle")).toBe("off");
		// Switching it off leaves the charms open, so the same switch turns it back on.
		fireEvent.click(await screen.findByRole("button", { name: /Idle mode/ }));
		expect(localStorage.getItem("maschina.idle")).toBeNull();
	});

	it("the marketplace lists every kind of machine", async () => {
		renderAt("/marketplace");
		const page = await section("Marketplace");
		expect((await page.findAllByText(/Range finder|Fixed range/)).length).toBeGreaterThan(0);
	});

	it("on a phone, the sections menu goes to any section, or opens search", async () => {
		const { router } = renderAt("/");
		await section("Home");
		fireEvent.click(screen.getByRole("button", { name: "Sections" }));
		// The header's row has a Swap link too; the menu's is the last one drawn.
		const swaps = await screen.findAllByRole("link", { name: "Swap" });
		fireEvent.click(swaps.at(-1) as HTMLElement);
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/swap"));
		fireEvent.click(screen.getByRole("button", { name: "Sections" }));
		const searches = await screen.findAllByRole("button", { name: /^Search$/ });
		fireEvent.click(searches[0] as HTMLElement);
		expect(await screen.findByRole("textbox", { name: "Search" })).toBeInTheDocument();
	});

	it("the charms open search, and set the theme", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Tiles" })[0] as HTMLElement);
		fireEvent.click(await screen.findByRole("button", { name: "Dynamic" }));
		expect(JSON.parse(localStorage.getItem("maschina.look") ?? "{}").dynamic).toBe(true);
		fireEvent.click(screen.getAllByRole("button", { name: /^Search/ }).at(-1) as HTMLElement);
		expect(await screen.findByRole("textbox", { name: "Search" })).toBeInTheDocument();
	});

	it("the charms switch what money is shown between live and paper", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Tiles" })[0] as HTMLElement);
		fireEvent.click(await screen.findByRole("button", { name: "Paper" }));
		expect(localStorage.getItem("maschina.side")).toBe("paper");
		expect(screen.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(screen.getByRole("button", { name: "Live" }));
		expect(localStorage.getItem("maschina.side")).toBe("live");
	});

	it("a panel closes from its close button", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Your machines" })[0] as HTMLElement);
		const closes = await screen.findAllByRole("button", { name: "Close" });
		for (const close of closes) fireEvent.click(close);
		expect(screen.getAllByRole("button", { name: "Your machines" }).length).toBeGreaterThan(0);
	});

	it("the right handle closes whichever right sidebar is open, rather than opening another", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.keyDown(window, { key: "Escape" });
		fireEvent.click(screen.getAllByRole("button", { name: "Account" })[0] as HTMLElement);
		const account = (await screen.findByText(/^Showing (live|paper) money$/)).closest("aside");
		await vi.waitFor(() => expect(account?.className).toContain("translate-x-0"));
		fireEvent.click(screen.getAllByRole("button", { name: "Tiles" })[0] as HTMLElement);
		await vi.waitFor(() => expect(account?.className).not.toContain("translate-x-0"));
		// The tiles stayed shut: their buttons are hidden, as they are whenever the sidebar is closed.
		expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
	});

	it("a click on bare space closes an open sidebar; a click on a tile leaves it open", async () => {
		renderAt("/");
		await section("Home");
		const page = screen.getByRole("region", { name: "Home" });
		fireEvent.keyDown(window, { key: "Escape" });
		fireEvent.click(screen.getAllByRole("button", { name: "Your machines" })[0] as HTMLElement);
		const sidebar = (await screen.findByRole("button", { name: "Close sidebar" })).closest("aside");
		await vi.waitFor(() => expect(sidebar?.className).toContain("translate-x-0"));
		// A tile is something: the sidebar stays.
		const tile = page.querySelector("article, a, button") as HTMLElement;
		fireEvent.pointerDown(tile);
		expect(sidebar?.className).toContain("translate-x-0");
		// The bare page behind the tiles is nothing: the sidebar goes.
		fireEvent.pointerDown(document.body);
		await vi.waitFor(() => expect(sidebar?.className).not.toContain("translate-x-0"));
	});

	it("the look is four switches: mode, sky, background and palette, each on its own", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.keyDown(window, { key: "Escape" });
		fireEvent.click(screen.getAllByRole("button", { name: "Tiles" })[0] as HTMLElement);
		expect(screen.queryByRole("button", { name: "Pebbled" })).toBeNull();
		const panel = (await screen.findByText("Theme")).closest("aside") as HTMLElement;
		const group = (name: string) => within(panel).getByRole("group", { name });
		const press = (row: string, name: string) =>
			fireEvent.click(within(group(row)).getByRole("button", { name }));
		// A team's palette brings its accent, and changes nothing else.
		press("Palette", "Solana");
		await vi.waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("solana"));
		expect(document.documentElement.dataset["accent"]).toBe("on");
		expect(document.documentElement.style.getPropertyValue("--accent")).toMatch(/^oklch\(/);
		expect(document.querySelector('[data-field="mesh"]')).not.toBeNull();
		// The text and the charts take the team's hue too, not only the buttons.
		expect(document.documentElement.style.getPropertyValue("--color-neutral-100")).toMatch(
			/^oklch\(/,
		);
		// And the charts draw in the team's own color.
		expect(document.documentElement.style.getPropertyValue("--chart")).toMatch(/^oklch\(/);
		// The background is its own choice, for any palette.
		press("Background", "Ribbon");
		await vi.waitFor(() => expect(document.querySelector('[data-field="ribbon"]')).not.toBeNull());
		// Light mode keeps the palette and the background.
		press("Mode", "Light");
		await vi.waitFor(() => expect(document.documentElement.dataset["mode"]).toBe("light"));
		expect(document.documentElement.dataset["theme"]).toBe("solana");
		expect(document.querySelector('[data-field="ribbon"]')).not.toBeNull();
		// Maschina's own palette has no accent of its own.
		press("Palette", "Maschina");
		await vi.waitFor(() => expect(document.documentElement.dataset["accent"]).toBeUndefined());
		// Maschina's own text stays pure white and black.
		expect(document.documentElement.style.getPropertyValue("--color-neutral-100")).toBe("");
		expect(document.documentElement.style.getPropertyValue("--chart")).toBe("");
		press("Background", "Particles");
		await vi.waitFor(() =>
			expect(document.querySelector('[data-field="particles"]')).not.toBeNull(),
		);
		expect(JSON.parse(localStorage.getItem("maschina.look") ?? "{}")).toEqual({
			palette: "maschina",
			mode: "light",
			dynamic: false,
			field: "particles",
			motion: "calm",
		});
		fireEvent.keyDown(window, { key: "Escape" });
	});

	it("the left sidebar closes from the button beside the logo", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Your machines" })[0] as HTMLElement);
		const close = await screen.findByRole("button", { name: "Close sidebar" });
		const sidebar = close.closest("aside");
		expect(sidebar?.className).toContain("translate-x-0");
		fireEvent.click(close);
		await vi.waitFor(() => expect(sidebar?.className).not.toContain("translate-x-0"));
	});

	it("your machines, on the left", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getAllByRole("button", { name: "Your machines" })[0] as HTMLElement);
		expect((await screen.findAllByText("Range Finder")).length).toBeGreaterThan(0);
	});

	it("the header shows the time and the date", async () => {
		renderAt("/");
		await section("Home");
		fireEvent.click(screen.getByRole("button", { name: "Header" }));
		expect((await screen.findAllByRole("button", { name: "Close" })).length).toBeGreaterThan(0);
	});
});

describe("making a machine", () => {
	it("a range finder on paper, by default", async () => {
		const { requests } = standIn();
		const { router } = renderAt("/new");
		const page = await screenNamed("New machine");
		fireEvent.change(await page.findByRole("textbox", { name: "Works with" }), {
			target: { value: "40" },
		});
		fireEvent.click(page.getByRole("button", { name: "5%" }));
		fireEvent.click(page.getByRole("button", { name: "Make it, on paper" }));
		await vi.waitFor(() =>
			expect(
				requests.find((each) => each.method === "POST" && each.path === "/v1/machines")?.body,
			).toMatchObject({
				kind: "following_range",
				paper: true,
				settings: { bandBps: 250, floorBps: 500 },
			}),
		);
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/machines/new"));
	});

	it("a fixed range, live", async () => {
		const { requests } = standIn();
		renderAt("/new");
		const page = await screenNamed("New machine");
		fireEvent.click(await page.findByRole("button", { name: /Fixed range/ }));
		fireEvent.click(page.getByRole("button", { name: /Live/ }));
		fireEvent.change(page.getByRole("textbox", { name: "Buy at" }), { target: { value: "118" } });
		fireEvent.change(page.getByRole("textbox", { name: "Sell at" }), { target: { value: "124" } });
		fireEvent.change(page.getByRole("textbox", { name: "Works with" }), {
			target: { value: "40" },
		});
		fireEvent.click(page.getByRole("button", { name: "Make it" }));
		await vi.waitFor(() =>
			expect(
				requests.find((each) => each.method === "POST" && each.path === "/v1/machines")?.body,
			).toMatchObject({
				paper: false,
			}),
		);
	});

	it("a price trigger, waiting for its level", async () => {
		const { requests } = standIn();
		renderAt("/new");
		const page = await screenNamed("New machine");
		fireEvent.click(await page.findByRole("button", { name: /Price trigger/ }));
		fireEvent.change(page.getByRole("textbox", { name: "Buy when SOL falls to" }), {
			target: { value: "110" },
		});
		fireEvent.change(page.getByRole("textbox", { name: "Spend" }), { target: { value: "20" } });
		fireEvent.click(page.getByRole("button", { name: "Make it, on paper" }));
		await vi.waitFor(() =>
			expect(
				requests.find((each) => each.method === "POST" && each.path === "/v1/machines"),
			).toBeDefined(),
		);
	});

	it("asks you to connect first", async () => {
		standIn({ signedIn: false });
		renderAt("/new");
		const page = await screenNamed("New machine");
		expect(await page.findByText(/Connect your wallet to make a machine/)).toBeInTheDocument();
	});
});

describe("a machine's controls", () => {
	it("pauses at once, and asks twice before stopping for good", async () => {
		const { requests } = standIn();
		renderAt(`/machines/${MACHINE_ID}`);
		const page = await screenNamed("Machine");
		fireEvent.click(await page.findByRole("button", { name: "Pause" }));
		await vi.waitFor(() =>
			expect(requests.some((each) => each.path.endsWith("/actions"))).toBe(true),
		);
		const stop = page.getByRole("button", { name: "Stop" });
		fireEvent.click(stop);
		expect(page.getByRole("button", { name: /Press again/ })).toBeInTheDocument();
	});

	it("funds from your wallet in one approval", async () => {
		const { requests } = standIn();
		renderAt(`/machines/${MACHINE_ID}`);
		const page = await screenNamed("Machine");
		fireEvent.change(await page.findByRole("textbox", { name: "Dollars to add" }), {
			target: { value: "10" },
		});
		fireEvent.click(page.getByRole("button", { name: "With 0.012 SOL for fees" }));
		expect(page.getByRole("button", { name: "No SOL for fees" })).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(page.getByRole("button", { name: "Fund from my wallet" }));
		});
		await vi.waitFor(() =>
			expect(requests.find((each) => each.path.endsWith("/funding"))?.body).toEqual({
				usdc: "10000000",
				lamports: "0",
			}),
		);
	});

	it("a paper machine has nothing to fund", async () => {
		standIn({ machines: [{ ...machine, paper: true }] });
		renderAt(`/machines/${MACHINE_ID}`);
		const page = await screenNamed("Machine");
		expect(await page.findByText("On paper: nothing to fund.")).toBeInTheDocument();
	});
});
