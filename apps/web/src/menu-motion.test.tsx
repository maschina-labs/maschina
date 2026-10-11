import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";
import { SOCIALS } from "./socials.ts";

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
	const openMenu = (navigate = vi.fn()) => {
		render(<Header authUrl={AUTH} navigate={navigate} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		return screen.getByRole("navigation", { name: "Pages, menu" });
	};

	it("is the same open field as on a desktop, always there, at the very top above Product and inside the margins", () => {
		const nav = openMenu();
		const box = within(nav).getByRole("searchbox", { name: "Search Maschina" });
		// The same field as on a desktop: its words, its display type, and no box or fill around it.
		expect(box).toHaveAttribute("placeholder", "Search Maschina");
		expect(box.className).toContain("bg-transparent");
		expect(box.className).toContain("font-display");
		expect(box.className).not.toMatch(/(^|\s)bg-white/);
		expect(box.tagName).toBe("INPUT");
		// A field, not a button: nothing to press first.
		expect(within(nav).queryByRole("button", { name: "Search" })).toBeNull();
		const product = within(nav).getByRole("button", { name: "Product" });
		expect(nav.firstElementChild?.contains(box)).toBe(true);
		expect(box.compareDocumentPosition(product) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(box.className).toContain("w-full");
		expect(box.className).not.toMatch(/rounded/);
		expect(nav.className).toContain("px-(--gutter)");
	});

	it("shows the matching pages right under it as you type, in place of the list of pages, and brings the list back when it is cleared", () => {
		const nav = openMenu();
		const box = within(nav).getByRole("searchbox", { name: "Search Maschina" });
		expect(within(nav).getByRole("button", { name: "Product" })).toBeInTheDocument();
		fireEvent.change(box, { target: { value: "pricing" } });
		expect(within(nav).getByRole("link", { name: /Pricing/ })).toHaveAttribute("href", "/pricing");
		expect(within(nav).queryByRole("button", { name: "Product" })).toBeNull();
		// The separate search panel is not opened: it all happens in the menu.
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
		fireEvent.change(box, { target: { value: "" } });
		expect(within(nav).getByRole("button", { name: "Product" })).toBeInTheDocument();
	});

	it("says plainly when nothing matches, and goes to the first match on Enter", () => {
		const navigate = vi.fn();
		const nav = openMenu(navigate);
		const box = within(nav).getByRole("searchbox", { name: "Search Maschina" });
		fireEvent.change(box, { target: { value: "zzzzqq" } });
		expect(within(nav).getByText("No pages match.")).toBeInTheDocument();
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).not.toHaveBeenCalled();
		fireEvent.change(box, { target: { value: "pricing" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).toHaveBeenLastCalledWith("/pricing");
	});

	it("starts empty each time the menu is opened", () => {
		const nav = openMenu();
		fireEvent.change(within(nav).getByRole("searchbox", { name: "Search Maschina" }), {
			target: { value: "docs" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(500);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		const again = screen.getByRole("navigation", { name: "Pages, menu" });
		expect(within(again).getByRole("searchbox", { name: "Search Maschina" })).toHaveValue("");
	});
});

describe("the socials in the phone menu", () => {
	const open = () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		return screen.getByRole("navigation", { name: "Pages, menu" });
	};

	it("sit in a centered row at the very bottom of the menu, the same squares as the footer's", () => {
		const nav = open();
		const row = nav.lastElementChild as HTMLElement;
		expect(row.className).toContain("justify-center");
		expect(row.className).toContain("flex");
		const links = within(row).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(
			SOCIALS.map((social) => social.href),
		);
		for (const [index, link] of links.entries()) {
			expect(link).toHaveAccessibleName(SOCIALS[index]?.label ?? "");
			expect(link.className).toContain("size-9");
			expect(link.className).toContain("bg-white/[0.07]");
			expect(link.className).not.toMatch(/rounded/);
			expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("are still the last thing while something is typed in the search", () => {
		const nav = open();
		fireEvent.change(within(nav).getByRole("searchbox", { name: "Search Maschina" }), {
			target: { value: "pricing" },
		});
		const row = nav.lastElementChild as HTMLElement;
		expect(within(row).getAllByRole("link")).toHaveLength(SOCIALS.length);
	});
});
