import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: the background, the charts and the globe are stood in for.
// Each has its own tests.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./components/price-chart.tsx", () => ({ PriceChart: () => <div>price chart</div> }));
vi.mock("./components/pnl-chart.tsx", () => ({ PnlChartView: () => <div>profit chart</div> }));
vi.mock("./components/globe.tsx", () => ({ Globe: () => <div /> }));

const { MACHINE_ID, machine, renderAt, standIn } = await import("./test/app.tsx");

/** The open screen: the detail layer, found by its title. */
const screenNamed = async (title: string) =>
	within(await screen.findByRole("dialog", { name: title }));

beforeEach(() => {
	localStorage.clear();
});

describe("every screen a tile opens, signed in with a machine at work", () => {
	beforeEach(() => {
		standIn();
	});

	it("profit: what was made, the round trips and each machine", async () => {
		renderAt("/profit");
		const profit = await screenNamed("Profit");
		expect((await profit.findAllByText("1.10 USDC")).length).toBe(2);
		expect(profit.getByText("Win rate")).toBeInTheDocument();
		expect(await profit.findByText("Range Finder")).toBeInTheDocument();
	});

	it("the vault: what was swept, and each machine's vault read from the chain", async () => {
		renderAt("/vault");
		const vault = await screenNamed("Vault");
		expect(await vault.findByText(/Swept to the vault · 1/)).toBeInTheDocument();
		expect(await vault.findByText("1.10 USDC")).toBeInTheDocument();
	});

	it("your machines: each one, and what they have altogether", async () => {
		renderAt("/fleet");
		const fleet = await screenNamed("Your machines");
		expect(await fleet.findByText("Range Finder")).toBeInTheDocument();
		expect(fleet.getByText("1 of 1")).toBeInTheDocument();
		expect(fleet.getByRole("link", { name: "New machine" })).toHaveAttribute("href", "/new");
	});

	it("decisions: what each machine weighed up, and how often the rules stopped it", async () => {
		renderAt("/decisions");
		const decisions = await screenNamed("Decisions");
		expect(await decisions.findByText(/Decisions · 4/)).toBeInTheDocument();
		expect(decisions.getByText("Stopped by the rules")).toBeInTheDocument();
	});

	it("trades: every trade, and what each machine waits to do next", async () => {
		renderAt("/trades");
		const trades = await screenNamed("Trades");
		expect(await trades.findByText(/bought SOL at 118.18/)).toBeInTheDocument();
		expect(trades.getByText(/sold SOL at 124.24/)).toBeInTheDocument();
		expect(trades.getByText("Waiting to")).toBeInTheDocument();
	});

	it("activity: everything, filtered, and all of it exportable", async () => {
		renderAt("/feed");
		const feed = await screenNamed("Activity");
		expect(await feed.findByText(/Everything that happened · 10/)).toBeInTheDocument();
		fireEvent.click(feed.getByRole("button", { name: "Trades" }));
		expect(await feed.findByText(/Everything that happened · [1-9]$/)).toBeInTheDocument();
		expect(feed.getByRole("button", { name: "Export everything as CSV" })).toBeEnabled();
	});

	it("SOL: the chart, its candles and the market", async () => {
		renderAt("/market/sol");
		const sol = await screenNamed("SOL");
		expect(await sol.findByText("price chart")).toBeInTheDocument();
		fireEvent.click(sol.getByRole("button", { name: "4h" }));
		expect(sol.getByRole("button", { name: "4h" })).toHaveAttribute("aria-pressed", "true");
		expect(sol.getByText("Listening to the market…")).toBeInTheDocument();
	});

	it("a machine: its band, its money, its record and its controls", async () => {
		renderAt(`/machines/${MACHINE_ID}`);
		const it_ = await screenNamed("Machine");
		expect(await it_.findByText(/Range Finder · running/i)).toBeInTheDocument();
		expect(it_.getByText(/Record · 10 entries/)).toBeInTheDocument();
		// Nothing typed still sends a little SOL for its fees, so funding is open from the start.
		expect(it_.getByRole("button", { name: "Fund from my wallet" })).toBeEnabled();
	});

	it("the manager: what needs you", async () => {
		renderAt("/manager");
		const manager = await screenNamed("Manager");
		expect(await manager.findByText("What it watches")).toBeInTheDocument();
	});

	it("settings: your wallet, more settings, fees and the theme", async () => {
		renderAt("/settings");
		const settings = await screenNamed("Settings");
		expect(await settings.findByText(/8GTgV1msc/)).toBeInTheDocument();
		fireEvent.click(settings.getByRole("button", { name: "Light" }));
		expect(settings.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
		expect(localStorage.getItem("maschina.theme")).toBe("light");
	});

	it("alerts: everything worth telling you, newest first", async () => {
		renderAt("/settings/alerts");
		const alerts = await screenNamed("Alerts");
		expect(await alerts.findByText(/Alerts · [1-9]/)).toBeInTheDocument();
	});

	it("the wallet: what came home", async () => {
		renderAt("/wallet");
		const wallet = await screenNamed("Wallet");
		expect(await wallet.findByText(/Range Finder · /)).toBeInTheDocument();
	});

	it("a public machine page shows its results and whole record, with nothing that acts", async () => {
		renderAt(`/m/${MACHINE_ID}`);
		const page = await screenNamed("Machine");
		expect(await page.findByText(/Its whole record · 10/)).toBeInTheDocument();
		expect(page.queryByRole("button", { name: /Stop|Pause|Fund/ })).not.toBeInTheDocument();
	});

	it("a machine that is not yours is said to be not yours", async () => {
		renderAt("/machines/somebody-else");
		const page = await screenNamed("Machine");
		expect(await page.findByText(/not yours, or does not exist/)).toBeInTheDocument();
	});
});

describe("paper and live never mix (D-096)", () => {
	const sandbox = {
		...machine,
		machineId: "01a0e674-0000-7000-8000-000000000001",
		name: "Sandbox",
		paper: true,
		budget: { ...machine.budget, granted: "500000000" },
		result: { ...machine.result, realised: "99000000", simulated: true },
	};

	it("profit counts the live machine only, however much paper made", async () => {
		standIn({ machines: [machine, sandbox] });
		renderAt("/profit");
		const profit = await screenNamed("Profit");
		expect((await profit.findAllByText("1.10 USDC")).length).toBeGreaterThan(0);
		expect(profit.queryByText(/100\.10|99\.00/)).toBeNull();
	});

	it("switched to paper, shows only paper money, says so across the top, and switches back", async () => {
		standIn({ machines: [machine, sandbox] });
		localStorage.setItem("maschina.side", "paper");
		renderAt("/profit");
		const profit = await screenNamed("Profit");
		expect((await profit.findAllByText("99.00 USDC")).length).toBeGreaterThan(0);
		expect(profit.queryByText("1.10 USDC")).toBeNull();
		const banner = await screen.findByRole("status", { name: "Showing paper" });
		expect(banner).toHaveTextContent(/none of this is real money/i);
		fireEvent.click(within(banner).getByRole("button", { name: "Back to live" }));
		expect((await profit.findAllByText("1.10 USDC")).length).toBeGreaterThan(0);
		expect(localStorage.getItem("maschina.side")).toBe("live");
	});

	it("the machine list shows both, and says which is paper", async () => {
		standIn({ machines: [machine, sandbox] });
		renderAt("/fleet");
		const fleet = await screenNamed("Your machines");
		expect(await fleet.findByText(/· paper/)).toBeInTheDocument();
		// Given to trade is the live 40.00, never the paper 500.
		expect(fleet.getAllByText("40.00 USDC").length).toBeGreaterThan(0);
		expect(fleet.queryByText("540.00 USDC")).toBeNull();
	});
});

describe("retuning a paused range finder", () => {
	it("sends the new band and floor, keeping everything else it runs on", async () => {
		const { requests } = standIn({ machines: [{ ...machine, state: "paused" }] });
		renderAt(`/machines/${MACHINE_ID}`);
		const page = await screenNamed("Machine");
		const save = await page.findByRole("button", { name: "Save the new band" });
		expect(save).toBeDisabled();
		fireEvent.click(page.getByRole("button", { name: "5%" }));
		fireEvent.click(save);
		await vi.waitFor(() =>
			expect(requests.find((each) => each.path.endsWith("/recipe"))?.body).toMatchObject({
				kind: "following_range",
				settings: { bandBps: 250, floorBps: 500, amountPerBuy: "39000000" },
			}),
		);
	});
});

describe("signed out", () => {
	beforeEach(() => {
		standIn({ signedIn: false });
	});

	it.each([
		["/profit", "Profit"],
		["/fleet", "Your machines"],
		["/vault", "Vault"],
		["/manager", "Manager"],
	])("%s asks you to connect rather than showing nothing", async (path, title) => {
		renderAt(path);
		const page = await screenNamed(title);
		expect((await page.findAllByText(/Connect your wallet/)).length).toBeGreaterThan(0);
	});

	it("sign in offers to connect", async () => {
		renderAt("/sign-in");
		const page = await screenNamed("Sign in");
		expect(await page.findByRole("button", { name: "Connect" })).toBeInTheDocument();
	});
});

describe("the screens that explain", () => {
	beforeEach(() => {
		standIn({ signedIn: false });
	});

	it.each([
		["/settings/keys", "Keys", "None yet"],
		["/wallet/stake", "Stake", "Idle SOL, earning"],
		["/welcome", "Welcome", "The guarantee"],
		["/get-a-wallet", "Get a wallet", "Phantom"],
		["/invite", "Invite", "The private beta"],
		["/legal/terms", "Terms", "Terms of use"],
		["/legal/privacy", "Privacy", "Privacy"],
		["/teams", "Teams", "Your teams"],
		["/teams/abc", "Team", "Conversation"],
		["/marketplace/abc", "Listing", "Track record"],
		["/network/abc", "Node", "Up for"],
		["/network/join", "Run a node", "What it needs"],
		["/u/ash", "Profile", "@ash"],
		["/maintenance", "Maintenance", "Back shortly"],
		["/papers", "Papers", "Index"],
	])("%s explains itself", async (path, title, text) => {
		renderAt(path);
		const page = await screenNamed(title);
		expect((await page.findAllByText(text)).length).toBeGreaterThan(0);
	});

	it("feedback fills in an email with what you wrote", async () => {
		renderAt("/feedback");
		const page = await screenNamed("Feedback");
		fireEvent.click(await page.findByRole("button", { name: "An idea" }));
		fireEvent.change(page.getByRole("textbox", { name: "What happened" }), {
			target: { value: "dark mode all day" },
		});
		expect(page.getByRole("link", { name: "Send" }).getAttribute("href")).toContain(
			"subject=Idea%3A%20dark%20mode%20all%20day",
		);
	});
});
