import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";

const AUTH = "https://auth.maschina.dev";
const find = (selector: string) => document.querySelector(selector) as HTMLElement | null;
const settle = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
	);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("the phone menu rolls down smoothly", () => {
	it("is revealed by a clip that opens from the top, which costs no layout work, instead of animating its height frame by frame", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const panel = find('[data-panel="menu"]') as HTMLElement;
		// Mounted closed: fully clipped away from the bottom, so it has somewhere to open from.
		expect(panel.className).toContain("[clip-path:inset(0_0_100%_0)]");
		expect(panel.className).toContain("transition-[clip-path]");
		expect(panel.className).toContain("motion-reduce:transition-none");
		expect(panel.className).not.toContain("grid-rows");
		settle(30);
		expect(panel.className).toContain("[clip-path:inset(0_0_0_0)]");
		expect(panel.className).not.toContain("[clip-path:inset(0_0_100%_0)]");
		// Told ahead of time that this is what will change, so the browser gives it its own layer.
		expect(panel.className).toContain("will-change-[clip-path]");
	});

	it("uses a long soft ease that slows to a stop, not a plain ease-out", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const panel = find('[data-panel="menu"]') as HTMLElement;
		expect(panel.className).toContain("ease-[cubic-bezier(0.22,1,0.36,1)]");
		expect(panel.className).toContain("duration-[420ms]");
	});

	it("dims the page behind it without blurring it on a phone: a full screen blur redraws every frame and makes the motion stutter", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const dim = find("[data-backdrop]") as HTMLElement;
		expect(dim.className).toContain("max-xl:backdrop-blur-none");
		expect(dim.className).toContain("max-xl:bg-black/70");
		// The desktop's blurred glass is as it was.
		expect(dim.className).toContain("backdrop-blur-xl");
		expect(dim.className).toContain("bg-black/30");
	});

	it("opens a group inside the menu with the same soft ease", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		const nav = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		const group = nav
			.getByRole("button", { name: "Product" })
			.parentElement?.querySelector("[data-panel='section']") as HTMLElement;
		expect(group.className).toContain("ease-[cubic-bezier(0.22,1,0.36,1)]");
		expect(group.className).toContain("duration-[350ms]");
	});
});

describe("the search in the phone menu", () => {
	it("sits at the very top, above Product, as a full width field-like button inside the margins", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		const nav = screen.getByRole("navigation", { name: "Pages, menu" });
		const search = within(nav).getByRole("button", { name: "Search" });
		const product = within(nav).getByRole("button", { name: "Product" });
		// First in the list, before every page.
		expect(nav.firstElementChild).toBe(search);
		expect(search.compareDocumentPosition(product) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// Full width of the menu, which already keeps to the page margins; no rounding; tall enough to press.
		expect(search.className).toContain("w-full");
		expect(search.className).toContain("h-12");
		expect(search.className).not.toMatch(/rounded/);
		// It says what it does, and the visible words contain its accessible name.
		expect(search).toHaveTextContent("Search Maschina");
		expect(nav.className).toContain("px-(--gutter)");
	});

	it("is not repeated further down beside the log in buttons", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const nav = screen.getByRole("navigation", { name: "Pages, menu" });
		expect(within(nav).getAllByRole("button", { name: "Search" })).toHaveLength(1);
	});
});
