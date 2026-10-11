import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// No WebGL or canvas in a test browser: Home's charts, the background and the globe are stood in for.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));
vi.mock("./price-chart.tsx", () => ({ PriceChart: () => <div>price chart</div> }));
vi.mock("./pnl-chart.tsx", () => ({ PnlChartView: () => <div>profit chart</div> }));
vi.mock("./globe.tsx", () => ({ Globe: () => <div /> }));

const { renderAt, standIn } = await import("../test/app.tsx");
const { tabTitle } = await import("./tab-title.tsx");

describe("the tab title", () => {
	it.each([
		["/", "Home | Maschina"],
		["/insights", "Insights | Maschina"],
		["/portfolio", "Portfolio | Maschina"],
		["/machines", "Machines | Maschina"],
		["/machines/abc", "Machine | Maschina"],
		["/m/abc", "Machine | Maschina"],
		["/activity", "Activity | Maschina"],
		["/swap", "Swap | Maschina"],
		["/marketplace", "Marketplace | Maschina"],
		["/marketplace/xyz", "Listing | Maschina"],
		["/network", "Network | Maschina"],
		["/network/join", "Join the Network | Maschina"],
		["/network/node1", "Node | Maschina"],
		["/new", "New Machine | Maschina"],
		["/wallet", "Wallet | Maschina"],
		["/wallet/stake", "Stake | Maschina"],
		["/settings", "Settings | Maschina"],
		["/settings/keys", "Keys | Maschina"],
		["/settings/alerts", "Alerts | Maschina"],
		["/sign-in", "Sign In | Maschina"],
		["/get-a-wallet", "Get a Wallet | Maschina"],
		["/legal/terms", "Terms | Maschina"],
		["/legal/privacy", "Privacy | Maschina"],
		["/news/story", "News | Maschina"],
		["/teams", "Teams | Maschina"],
		["/teams/t1", "Team | Maschina"],
		["/u/ash", "Profile | Maschina"],
	])("names %s as %s: the page, then Maschina", (path, expected) => {
		expect(tabTitle(path)).toBe(expected);
	});

	it("is just the name for an address it has no name for", () => {
		expect(tabTitle("/nothing-here")).toBe("Maschina");
	});

	it("shows in the tab with no price in it, and follows the page", async () => {
		standIn({ signedIn: false });
		const { router } = renderAt("/");
		await screen.findAllByText(/Glad you|Connect/i, {}, { timeout: 5000 });
		expect(document.title).toBe("Home | Maschina");
		await router.navigate({ to: "/network" });
		await vi.waitFor(() => expect(document.title).toBe("Network | Maschina"));
		expect(document.title).not.toMatch(/SOL/);
	});
});
