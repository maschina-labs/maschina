import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Customize,
	Features,
	HowItWorks,
	LiveRecord,
	Marketplace,
	Network,
	Safety,
} from "./sections.tsx";

beforeEach(() =>
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("{}", { status: 500 })),
	),
);
afterEach(() => vi.unstubAllGlobals());
const AUTH = "/auth";
const sections = [
	["How It Works", <HowItWorks key="how" authUrl={AUTH} />],
	["Inside the App", <Features key="features" authUrl={AUTH} />],
	["Safety", <Safety key="safety" />],
	["Customize", <Customize key="customize" authUrl={AUTH} />],
	["Live Record", <LiveRecord key="record" />],
	["Network", <Network key="network" />],
	["Marketplace", <Marketplace key="marketplace" />],
] as const;

describe("saved homepage sections", () => {
	it.each(sections)("keeps %s readable and available for later iteration", (name, element) => {
		const { container } = render(element);
		const section = screen.getByRole("region", { name });
		expect(within(section).getByRole("heading", { level: 2 })).not.toBeEmptyDOMElement();
		expect(section).toHaveClass("bg-black", "px-(--gutter)");
		expect(container.innerHTML).not.toContain("rounded");
		expect(section.textContent).not.toMatch(/guaranteed returns|fully audited|insured funds/i);
	});
	it("keeps the three configuration steps in order", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		expect(
			[...container.querySelectorAll("[data-step] h3")].map((node) => node.textContent),
		).toEqual(["Pick a kind", "Set its limits", "Let it work"]);
	});
	it("keeps the app sample disclosure and owner settings", () => {
		const first = render(<Features authUrl={AUTH} />);
		expect(screen.getByText("Sample data.")).toBeInTheDocument();
		expect(first.container.querySelectorAll("[data-tile]")).toHaveLength(4);
		first.unmount();
		const { container } = render(<Customize authUrl={AUTH} />);
		expect(
			[...container.querySelectorAll("[data-setting] span")].map((node) => node.textContent),
		).toEqual(["Range", "Floor", "Amount per trade", "Daily limit"]);
	});
	it("retains the audit limitation and separates the decision gates", () => {
		const { container } = render(<Safety />);
		expect(container.querySelectorAll("[data-flow]")).toHaveLength(4);
		expect(screen.getByText(/has not been independently audited/)).toBeInTheDocument();
	});
	it("links the live record internally and never replaces an unavailable API with sample trades", async () => {
		render(<LiveRecord />);
		expect(screen.getByRole("link")).toHaveAttribute("href", "/live");
		expect(await screen.findByText(/could not|unavailable|couldn.t/i)).toBeInTheDocument();
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});
	it("loads the saved globe only near the viewport", () => {
		const watchers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
					watchers.push(callback);
				}
				observe() {}
				disconnect() {}
			},
		);
		const { container } = render(<Network />);
		expect(container.querySelector("[data-near]")).toHaveAttribute("data-near", "false");
		act(() => {
			for (const notify of watchers) notify([{ isIntersecting: true }]);
		});
		expect(container.querySelector("[data-near]")).toHaveAttribute("data-near", "true");
	});
	it("keeps pointer decoration inert for touch", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		const card = container.querySelector(".card-dots") as HTMLElement;
		card.getBoundingClientRect = () => ({ left: 100, top: 40 }) as DOMRect;
		fireEvent.pointerMove(card, { clientX: 160, clientY: 90 });
		expect(card.style.getPropertyValue("--mx")).toBe("60px");
		fireEvent.pointerMove(card, { clientX: 300, clientY: 60, pointerType: "touch" });
		expect(card.style.getPropertyValue("--mx")).toBe("60px");
	});
});
