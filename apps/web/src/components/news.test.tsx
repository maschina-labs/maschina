import { fireEvent, screen, within } from "@testing-library/react";
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

const feed = async () => screen.findByRole("feed", { name: "News" });

describe("the news under Home", () => {
	it("sits below your own tiles, apart from them, signed in or not", async () => {
		standIn({ signedIn: false });
		renderAt("/");
		const news = await feed();
		const home = screen.getByRole("region", { name: "Home" });
		expect(home.contains(news)).toBe(false);
		// Home's page comes first, the news after it.
		expect(home.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(await within(news).findByText("Open USD Is Live on Solana")).toBeDefined();
	});

	it("leads with the newest story large, and every story opens at its publisher", async () => {
		standIn();
		renderAt("/");
		const news = await feed();
		const stories = await within(news).findAllByRole("article");
		expect(stories).toHaveLength(3);
		const lead = stories[0] as HTMLElement;
		expect(lead.dataset["lead"]).toBe("true");
		// The picture is decoration beside the headline, so it is hidden from screen readers.
		expect(lead.querySelector("img")?.getAttribute("src")).toBe(
			"https://solana.com/uploads/hero.webp",
		);
		const link = within(lead).getByRole("link", { name: /Open USD Is Live on Solana/ });
		expect(link.getAttribute("href")).toBe("https://solana.com/news/open-usd");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
		expect(within(lead).getByText(/Solana/, { selector: "[data-source]" })).toBeDefined();
	});

	it("narrows to Solana, or to one source, from the rail beside it", async () => {
		standIn();
		renderAt("/");
		const news = await feed();
		await within(news).findAllByRole("article");
		const rail = screen.getByRole("navigation", { name: "News sources" });
		fireEvent.click(within(rail).getByRole("button", { name: "Solana only" }));
		expect(within(news).getAllByRole("article")).toHaveLength(2);
		expect(within(news).queryByText("Crypto job postings triple")).toBeNull();
		fireEvent.click(within(rail).getByRole("button", { name: "Decrypt" }));
		expect(within(news).getAllByRole("article")).toHaveLength(1);
		expect(within(rail).getByRole("button", { name: "Decrypt" }).getAttribute("aria-pressed")).toBe(
			"true",
		);
		fireEvent.click(within(rail).getByRole("button", { name: "All news" }));
		expect(within(news).getAllByRole("article")).toHaveLength(3);
	});

	it("is only under Home: other sections have none", async () => {
		standIn();
		renderAt("/machines");
		await screen.findByRole("region", { name: "Machines" });
		expect(screen.queryByRole("feed", { name: "News" })).toBeNull();
	});
});
