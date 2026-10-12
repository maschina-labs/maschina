import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the header", () => {
	it("is the mark and the word, and it leads home", () => {
		render(<Header authUrl={AUTH} />);
		const home = within(screen.getByRole("banner")).getByRole("link", { name: "Maschina, home" });
		expect(home).toHaveAttribute("href", "/");
		expect(home.querySelector("[data-mark]")).toHaveAttribute("src", "/brand/favicon.svg");
		expect(home.querySelector("[data-word] img")).toHaveAttribute("src", "/brand/word.svg");
		// Its size is declared (the file is 1054 by 175, shown 20 high), so nothing shifts as it loads.
		expect(home.querySelector("[data-word] img")).toHaveAttribute("height", "20");
		expect(home.querySelector("[data-word] img")).toHaveAttribute("width", "120");
	});

	it("turns the mark a full turn forward each time the cursor arrives, and never back", () => {
		render(<Header authUrl={AUTH} />);
		const mark = screen.getByRole("banner").querySelector("[data-mark]") as HTMLElement;
		expect(mark.style.transform).toBe("rotate(0deg)");
		fireEvent.pointerEnter(mark);
		expect(mark.style.transform).toBe("rotate(360deg)");
		fireEvent.pointerLeave(mark);
		expect(mark.style.transform).toBe("rotate(360deg)");
		fireEvent.pointerEnter(mark);
		expect(mark.style.transform).toBe("rotate(720deg)");
	});

	it("has Log in as plain text, in no box, like the pages, on a desktop (the pearl button beside the menu button on a phone)", () => {
		render(<Header authUrl={AUTH} />);
		const logIn = within(screen.getByRole("banner")).getByRole("link", { name: "Sign In" });
		// On a desktop it has no box at all: its only background classes are for a phone.
		expect(logIn.className).not.toMatch(/(^|\s)(xl:)?bg-/);
		expect(logIn.className).toContain("xl:inline-block");
	});

	it("leads to log in and sign up, wherever auth lives", () => {
		render(<Header authUrl="http://localhost:3001" />);
		const header = within(screen.getByRole("banner"));
		expect(header.getByRole("link", { name: "Sign In" })).toHaveAttribute(
			"href",
			"http://localhost:3001/sign-in",
		);
		expect(header.getByRole("link", { name: "Try Maschina" })).toHaveAttribute(
			"href",
			"http://localhost:3001/sign-up",
		);
	});

	it("lists the pages in the agreed order", () => {
		render(<Header authUrl={AUTH} />);
		const pages = screen.getByRole("navigation", { name: "Pages" });
		expect([...pages.children].map((item) => item.textContent)).toEqual([
			"Product",
			"Developers",
			"Company",
			"Live Record",
			"Papers",
			"Pricing",
		]);
	});

	it("keeps the pages on the left, beside the wordmark", () => {
		render(<Header authUrl={AUTH} />);
		const pages = screen.getByRole("navigation", { name: "Pages" });
		const left = screen.getByRole("link", { name: "Maschina, home" }).parentElement as HTMLElement;
		expect(left.contains(pages)).toBe(true);
		const logIn = within(screen.getByRole("banner")).getByRole("link", { name: "Sign In" });
		expect(left.contains(logIn)).toBe(false);
	});

	it("puts the search by itself right after the pages: just the icon, in no box", () => {
		render(<Header authUrl={AUTH} />);
		const pages = screen.getByRole("navigation", { name: "Pages" });
		const search = within(screen.getByRole("banner")).getByRole("button", { name: "Search" });
		expect(search.previousElementSibling).toBe(pages);
		expect(pages.lastElementChild?.textContent).toBe("Pricing");
		expect(search.className).not.toMatch(/\bbg-/);
		expect(search.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
	});

	it("opens a dropdown from three of them, and links straight to the other two", () => {
		render(<Header authUrl={AUTH} />);
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		for (const name of ["Product", "Developers", "Company"]) {
			const trigger = pages.getByRole("button", { name });
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		}
		for (const name of ["Live Record", "Papers", "Pricing"]) {
			const link = pages.getByRole("link", { name });
			expect(link.querySelector("svg")).toBeNull();
		}
		// The live record is an app of its own, so this link leaves the site for it.
		expect(pages.getByRole("link", { name: "Live Record" })).toHaveAttribute(
			"href",
			"https://live.maschina.dev",
		);
	});

	it("opens on hover, full width, with the big links on the left and the small ones beside them", () => {
		render(<Header authUrl={AUTH} />);
		expect(screen.queryByRole("region", { name: "Developers" })).toBeNull();

		fireEvent.mouseEnter(screen.getByRole("button", { name: "Developers" }));
		const panel = screen.getByRole("region", { name: "Developers" });
		expect((panel.parentElement as HTMLElement).className).toContain("inset-x-0");
		const inside = within(panel);
		for (const name of ["Docs", "API", "SDK", "Machine Spec", "Templates"]) {
			expect(inside.getByRole("link", { name })).toBeInTheDocument();
		}
		expect(inside.getByRole("link", { name: "GitHub" })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs",
		);
		for (const name of ["AI Index", "Skill File"]) {
			expect(inside.getByRole("link", { name })).toBeInTheDocument();
		}
		// The status page is run by someone else, on its own address.
		expect(inside.getByRole("link", { name: "Status" })).toHaveAttribute(
			"href",
			"https://status.maschina.dev",
		);
		// Not built yet: named, tagged Soon, and not a link.
		for (const name of ["MCP Server"]) {
			expect(inside.queryByRole("link", { name: new RegExp(name) })).toBeNull();
			expect(inside.getByText(name)).toBeInTheDocument();
		}
		expect(screen.getByRole("button", { name: "Developers" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});

	it("switches to another dropdown as the cursor moves along the header", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Developers" }));
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Company" }));
		expect(screen.queryByRole("region", { name: "Developers" })).toBeNull();
		const company = within(screen.getByRole("region", { name: "Company" }));
		for (const name of ["About", "Roadmap", "Changelog", "Contact"]) {
			expect(company.getByRole("link", { name })).toBeInTheDocument();
		}
	});

	it("shows what is not built yet as dimmed and tagged Soon, never as a link", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		const panel = within(screen.getByRole("region", { name: "Product" }));
		for (const name of ["Overview", "Security"]) {
			expect(panel.getByRole("link", { name })).toBeInTheDocument();
		}
		for (const name of ["Marketplace", "Network", "Mobile"]) {
			expect(panel.queryByRole("link", { name: new RegExp(name) })).toBeNull();
			expect(panel.getByText(name).closest("[aria-disabled]")).toHaveAttribute(
				"aria-disabled",
				"true",
			);
		}
		expect(panel.getAllByText("Soon")).toHaveLength(3);
	});

	it("closes a moment after the cursor leaves the header, not instantly", () => {
		vi.useFakeTimers();
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		fireEvent.mouseLeave(screen.getByRole("banner"));
		expect(screen.getByRole("region", { name: "Product" })).toBeInTheDocument();
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(screen.queryByRole("region", { name: "Product" })).toBeNull();
		vi.useRealTimers();
	});

	it("stays open when the cursor crosses from the trigger onto the panel", () => {
		vi.useFakeTimers();
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		fireEvent.mouseLeave(screen.getByRole("banner"));
		fireEvent.mouseEnter(screen.getByRole("banner"));
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(screen.getByRole("region", { name: "Product" })).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("closes when the cursor moves onto a plain link", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		fireEvent.mouseEnter(screen.getByRole("link", { name: "Pricing" }));
		expect(screen.queryByRole("region", { name: "Product" })).toBeNull();
	});

	it("also opens and closes by click and Escape, for keyboards and touch", () => {
		render(<Header authUrl={AUTH} />);
		const trigger = screen.getByRole("button", { name: "Company" });
		fireEvent.click(trigger);
		expect(screen.getByRole("region", { name: "Company" })).toBeInTheDocument();
		fireEvent.click(trigger);
		expect(screen.queryByRole("region", { name: "Company" })).toBeNull();

		fireEvent.click(trigger);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("region", { name: "Company" })).toBeNull();
	});

	it("dims the page behind an open dropdown, and a click on it closes the dropdown", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		expect(container.querySelector("[data-backdrop]")).toBeNull();
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).toHaveAttribute("aria-hidden", "true");
		fireEvent.click(backdrop);
		expect(screen.queryByRole("region", { name: "Product" })).toBeNull();
	});

	it("blurs the page behind an open panel like frosted glass, with only a light tint over it", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		const { className } = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(className).toContain("backdrop-blur-xl");
		// The tint is light: the blur does the work, not a dark overlay.
		expect(className).toContain("bg-black/30");
		expect(className).not.toContain("bg-black/60");
	});

	it("keeps the content of the bar where it was: same height and padding, with the blur behind it", () => {
		render(<Header authUrl={AUTH} />);
		const header = screen.getByRole("banner");
		const bar = header.querySelector("[data-fade]")?.nextElementSibling
			?.nextElementSibling as HTMLElement;
		expect(bar.className).toContain("py-5");
		expect(bar.className).toContain("xl:py-4");
		expect(bar.className).toContain("px-(--gutter)");
	});

	it("takes a solid background while a dropdown is open, so the two read as one piece", () => {
		render(<Header authUrl={AUTH} />);
		const header = screen.getByRole("banner");
		expect(header.querySelector("[data-solid]")?.className).toContain("opacity-0");
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		expect(header.querySelector("[data-solid]")?.className).toContain("opacity-100");
		expect(header.querySelector("[data-solid]")?.className).toContain("bg-black");
	});

	it("opens the same kind of dropdown on a phone: full width, joined to the header", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();

		fireEvent.click(menu);
		expect(menu).toHaveAttribute("aria-expanded", "true");
		const panel = screen.getByRole("navigation", { name: "Pages, menu" });
		const wrapper = panel.parentElement?.parentElement;
		expect(wrapper?.className).toContain("inset-x-0");
		expect(screen.getByRole("banner").querySelector("[data-solid]")?.className).toContain(
			"opacity-100",
		);
		const open = within(panel);
		expect(open.getByRole("link", { name: "Live Record" })).toBeInTheDocument();
		expect(open.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
		expect(open.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", `${AUTH}/sign-in`);
		expect(open.getByRole("link", { name: "Try Maschina" })).toHaveAttribute(
			"href",
			`${AUTH}/sign-up`,
		);

		fireEvent.click(menu);
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();
	});

	it("expands each group in place on a phone, one at a time, with the same links as the desktop", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const panel = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		for (const name of ["Product", "Developers", "Company"]) {
			expect(panel.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
		}
		expect(panel.queryByRole("link", { name: "Overview" })).toBeNull();

		fireEvent.click(panel.getByRole("button", { name: "Product" }));
		expect(panel.getByRole("button", { name: "Product" })).toHaveAttribute("aria-expanded", "true");
		for (const name of ["Overview", "Security", "Live Record", "Changelog"]) {
			expect(panel.getAllByRole("link", { name }).length).toBeGreaterThan(0);
		}
		for (const name of ["Marketplace", "Network", "Mobile"]) {
			expect(panel.queryByRole("link", { name: new RegExp(name) })).toBeNull();
			expect(panel.getByText(name).closest("[aria-disabled]")).toHaveAttribute(
				"aria-disabled",
				"true",
			);
		}

		fireEvent.click(panel.getByRole("button", { name: "Developers" }));
		expect(panel.getByRole("button", { name: "Product" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(panel.queryByRole("link", { name: "Overview" })).toBeNull();
		expect(panel.getByRole("link", { name: "Docs" })).toBeInTheDocument();
		expect(panel.queryByRole("link", { name: /MCP Server/ })).toBeNull();
		expect(panel.getByText("MCP Server")).toBeInTheDocument();

		fireEvent.click(panel.getByRole("button", { name: "Developers" }));
		expect(panel.queryByRole("link", { name: "Docs" })).toBeNull();
	});

	it("dims the page behind the phone menu, and a click on it closes the menu", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		expect(container.querySelector("[data-backdrop]")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).toHaveAttribute("aria-hidden", "true");
		fireEvent.click(backdrop);
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();
	});

	it("closes the phone menu on Escape", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();
	});

	it("wraps the Try Maschina button closely around its chip: 4px of pearl all around", () => {
		render(<Header authUrl={AUTH} />);
		const link = within(screen.getByRole("banner")).getByRole("link", { name: "Try Maschina" });
		expect(link.className).toContain("py-1 ");
		expect(link.className).toContain("pr-1 ");
		expect(link.className).not.toContain("py-1.5");
		expect(link.querySelector("[data-chip]")?.className).toContain("size-6");
	});

	it("holds a small square chip with a right chevron inside the button, beside Try Maschina", () => {
		render(<Header authUrl={AUTH} />);
		const link = within(screen.getByRole("banner")).getByRole("link", { name: "Try Maschina" });
		const chip = link.querySelector("[data-chip]");
		expect(chip).not.toBeNull();
		expect(chip?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		expect(chip?.querySelector("svg")).toHaveAttribute("data-arrow", "chevron");
		expect(chip?.className).not.toMatch(/rounded/);
		expect(chip?.className).toContain("bg-black");
		expect(chip?.className).toContain("text-white");
		// Inset in the button, not stretched edge to edge: the pearl shows around it.
		expect(link.className).toContain("items-center");
		expect(link.className).not.toContain("items-stretch");
		// It sits after the words, on the right, and adds none to the button's name.
		expect(link.lastElementChild).toBe(chip);
		expect(link.firstElementChild?.textContent).toBe("Try Maschina");
	});

	it("has no glint on Try Maschina, in the bar or in the phone menu", () => {
		render(<Header authUrl={AUTH} />);
		const bar = within(screen.getByRole("banner")).getByRole("link", { name: "Try Maschina" });
		expect(bar.querySelector("[data-glint]")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const panel = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		expect(
			panel.getByRole("link", { name: "Try Maschina" }).querySelector("[data-glint]"),
		).toBeNull();
	});

	it("has the same chip on the phone menu's button", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const panel = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		const link = panel.getByRole("link", { name: "Try Maschina" });
		expect(link.querySelector("[data-chip]")).not.toBeNull();
	});

	it("has no language control: the site is only in English, so there is nothing to choose", () => {
		render(<Header authUrl={AUTH} />);
		expect(screen.queryByRole("combobox", { name: "Language" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(screen.queryByRole("combobox", { name: "Language" })).toBeNull();
	});

	it("has a search button that opens a panel under the header, with the cursor in it", () => {
		render(<Header authUrl={AUTH} />);
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		const panel = screen.getByRole("region", { name: "Search" });
		expect((panel.parentElement as HTMLElement).className).toContain("inset-x-0");
		const box = within(panel).getByRole("searchbox", { name: "Search Maschina" });
		expect(box).toHaveFocus();
	});

	it("narrows the pages as you type, and says so when none match", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		const panel = within(screen.getByRole("region", { name: "Search" }));
		const box = panel.getByRole("searchbox", { name: "Search Maschina" });

		// Nothing is listed until something is typed, and nothing is said about it.
		expect(panel.queryAllByRole("link")).toHaveLength(0);
		expect(panel.queryByText("No pages match.")).toBeNull();

		fireEvent.change(box, { target: { value: "spec" } });
		expect(panel.getByRole("link", { name: /Machine Spec/ })).toHaveAttribute(
			"href",
			"https://docs.maschina.dev/machine-spec",
		);
		expect(panel.queryByRole("link", { name: /Docs/ })).toBeNull();

		fireEvent.change(box, { target: { value: "pricing" } });
		expect(panel.getByRole("link", { name: /Pricing/ })).toHaveAttribute("href", "/pricing");

		fireEvent.change(box, { target: { value: "marketplace" } });
		expect(panel.queryAllByRole("link")).toHaveLength(0);
		expect(panel.getByText("No pages match.")).toBeInTheDocument();
	});

	it("goes to the first result on Enter, and to the one you arrowed to", () => {
		const navigate = vi.fn();
		render(<Header authUrl={AUTH} navigate={navigate} />);
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		const box = within(screen.getByRole("region", { name: "Search" })).getByRole("searchbox", {
			name: "Search Maschina",
		});
		fireEvent.change(box, { target: { value: "developers" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).toHaveBeenLastCalledWith("https://docs.maschina.dev");

		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).toHaveBeenLastCalledWith("https://docs.maschina.dev/api");

		fireEvent.keyDown(box, { key: "ArrowUp" });
		fireEvent.keyDown(box, { key: "ArrowUp" });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).toHaveBeenLastCalledWith("https://docs.maschina.dev");
	});

	it("does nothing on Enter when nothing has been typed", () => {
		const navigate = vi.fn();
		render(<Header authUrl={AUTH} navigate={navigate} />);
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		const box = within(screen.getByRole("region", { name: "Search" })).getByRole("searchbox", {
			name: "Search Maschina",
		});
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).not.toHaveBeenCalled();

		fireEvent.change(box, { target: { value: "docs" } });
		fireEvent.change(box, { target: { value: "  " } });
		expect(
			within(screen.getByRole("region", { name: "Search" })).queryAllByRole("link"),
		).toHaveLength(0);
	});

	it("does nothing on Enter when nothing matches", () => {
		const navigate = vi.fn();
		render(<Header authUrl={AUTH} navigate={navigate} />);
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		const box = within(screen.getByRole("region", { name: "Search" })).getByRole("searchbox", {
			name: "Search Maschina",
		});
		fireEvent.change(box, { target: { value: "zzzz" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).not.toHaveBeenCalled();
	});

	it("opens and closes with Ctrl or Command K, and closes on Escape", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.keyDown(document, { key: "k", ctrlKey: true });
		expect(screen.getByRole("region", { name: "Search" })).toBeInTheDocument();
		fireEvent.keyDown(document, { key: "k", ctrlKey: true });
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
		fireEvent.keyDown(document, { key: "k", metaKey: true });
		expect(screen.getByRole("region", { name: "Search" })).toBeInTheDocument();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
	});

	it("gives way to the dropdowns, and they to it, so only one panel is ever open", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Search" }));
		expect(screen.queryByRole("region", { name: "Product" })).toBeNull();
		expect(screen.getByRole("region", { name: "Search" })).toBeInTheDocument();

		fireEvent.mouseEnter(screen.getByRole("button", { name: "Company" }));
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
		expect(screen.getByRole("region", { name: "Company" })).toBeInTheDocument();
	});

	it("dims the page behind the search, and a click on it closes the search", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		fireEvent.keyDown(document, { key: "k", ctrlKey: true });
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).toHaveAttribute("aria-hidden", "true");
		fireEvent.click(backdrop);
		expect(screen.queryByRole("region", { name: "Search" })).toBeNull();
	});

	it("shows try Maschina as a button only on a wide screen, and log in as a button there and a small gray box on a phone", () => {
		render(<Header authUrl={AUTH} />);
		const banner = within(screen.getByRole("banner"));
		const tryIt = banner.getByRole("link", { name: "Try Maschina" });
		expect(tryIt.className).toContain("hidden");
		expect(tryIt.className).toMatch(/xl:inline-(block|flex)/);
		expect(banner.getByRole("link", { name: "Sign In" }).className).toMatch(
			/xl:inline-(block|flex)/,
		);
	});

	it("gives Sign In the black chip with a white arrow on a phone, like the pearl buttons, and no chip on a wide screen where it is plain text", () => {
		render(<Header authUrl={AUTH} />);
		const signIn = within(screen.getByRole("banner")).getByRole("link", { name: "Sign In" });
		const chip = signIn.querySelector("[data-chip]") as HTMLElement;
		expect(chip).not.toBeNull();
		expect(chip.className).toContain("bg-black");
		expect(chip.className).toContain("text-white");
		expect(chip.className).toContain("xl:hidden");
		const arrow = chip.querySelector("svg") as SVGElement;
		expect(arrow).toHaveAttribute("data-arrow", "chevron");
		expect(arrow).toHaveAttribute("aria-hidden", "true");
		// The words come first and the chip is last, as on Try Maschina.
		expect(signIn.lastElementChild).toBe(chip);
		expect(signIn.firstChild?.textContent).toBe("Sign In");
	});

	it("is a hamburger in a box of its own on a phone: an icon, no words", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu).toHaveAttribute("aria-label", "Menu");
		expect(menu.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		expect(menu).toHaveTextContent("");
		expect(menu.className).toContain("xl:hidden");
	});

	it("stays at the top of the screen as the page scrolls, as a sticky rail rather than a fixed bar, so it moves down with the page when it is pulled", () => {
		render(<Header authUrl={AUTH} />);
		const bar = screen.getByRole("banner");
		// A fixed bar stays glued to the screen while the page is pulled down to refresh, and the loader appears behind it.
		// A sticky rail of no height travels with the page, so the bar goes down with the page and the loader sits above it.
		expect(bar.className).not.toContain("fixed");
		expect(bar.className).toContain("absolute");
		expect(bar.className).toContain("inset-x-0");
		const rail = bar.parentElement as HTMLElement;
		expect(rail).toHaveAttribute("data-rail");
		expect(rail.className).toContain("sticky");
		expect(rail.className).toContain("top-0");
		expect(rail.className).toContain("h-0");
		expect(rail.className).toContain("z-40");
	});

	it("stays one attached bar: it turns from clear into frosted glass as the page scrolls, and never splits", () => {
		render(<Header authUrl={AUTH} />);
		const header = screen.getByRole("banner");
		const fade = () => header.querySelector("[data-fade]") as HTMLElement;
		const amount = () => fade().style.getPropertyValue("--fade");
		const scrollTo = (y: number) => {
			Object.defineProperty(window, "scrollY", { value: y, configurable: true });
			fireEvent.scroll(window);
		};
		expect(header.className).not.toMatch(/\bbg-/);
		expect(amount()).toBe("0");
		expect(header).not.toHaveAttribute("data-detached");

		scrollTo(120);
		expect(amount()).toBe("1");
		// Frosted glass, exactly the height of the bar: a dark tint you can see the page through, and a blur. It only comes in as the page scrolls, from clear to glass, and is never a gradient.
		expect(fade().className).toMatch(/bg-black\/\d+/);
		expect(fade().className).toContain("backdrop-blur");
		expect(fade().className).toContain("backdrop-saturate");
		// No line along the bottom: the glass just ends.
		expect(fade().className).not.toMatch(/border/);
		expect(fade().className).toContain("inset-0");
		expect(fade().className).not.toMatch(/bg-gradient|mask-image|h-\[calc/);
		expect(fade().className).toContain("-z-10");
		expect(fade().className).toContain("absolute");
		expect(header.firstElementChild).toBe(fade());
		expect(fade()).toHaveAttribute("aria-hidden", "true");
		expect(fade().className).toContain("pointer-events-none");
		// Still no solid fill while nothing is open.
		expect(header.querySelector("[data-solid]")?.className).toContain("opacity-0");
		expect(header.querySelector("[data-group]")).toBeNull();
		expect(header.querySelector("[data-word] img")).not.toBeNull();

		scrollTo(0);
		expect(amount()).toBe("0");
	});

	it("comes in as glass as you scroll: a little at first, all of it once the bar has gone by", () => {
		render(<Header authUrl={AUTH} />);
		const fade = screen.getByRole("banner").querySelector("[data-fade]") as HTMLElement;
		expect(fade.className).toContain("opacity-(--fade)");
		expect(fade.className).not.toContain("transition-");
		const at = (y: number) => {
			Object.defineProperty(window, "scrollY", { value: y, configurable: true });
			fireEvent.scroll(window);
			return Number(fade.style.getPropertyValue("--fade"));
		};
		expect(at(0)).toBe(0);
		// The bar is 90px tall here (jsdom has no layout, so the fallback height is used).
		expect(at(18)).toBeCloseTo(0.2, 5);
		expect(at(45)).toBeCloseTo(0.5, 5);
		expect(at(90)).toBe(1);
		expect(at(400)).toBe(1);
		expect(at(-30)).toBe(0);
	});

	it("is solid black behind an open dropdown, so the panel and the bar read as one", () => {
		render(<Header authUrl={AUTH} />);
		Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
		fireEvent.scroll(window);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		expect(screen.getByRole("banner").querySelector("[data-solid]")?.className).toContain(
			"opacity-100",
		);
	});

	it("keeps to the shared page margin, with no rounded corners", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		expect(container.innerHTML).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});

describe("the header's motion", () => {
	// Panels and surfaces move; words never do. Everything slides open and closed instead of blinking.
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const settle = (ms: number) =>
		act(() => {
			vi.advanceTimersByTime(ms);
		});
	const find = (selector: string) => document.querySelector(selector) as HTMLElement | null;

	it("slides a dropdown down from the header, and back up, instead of blinking", () => {
		render(<Header authUrl={AUTH} />);
		const product = screen.getByRole("button", { name: "Product" });
		fireEvent.mouseEnter(product);
		const panel = find('[data-panel="dropdown"]') as HTMLElement;
		// It arrives closed, and opens a frame later, so there is something to slide from.
		expect(panel).toHaveAttribute("data-state", "closed");
		expect(panel.className).toContain("grid-rows-[0fr]");
		settle(30);
		expect(panel).toHaveAttribute("data-state", "open");
		expect(panel.className).toContain("grid-rows-[1fr]");
		expect(panel).not.toHaveAttribute("aria-hidden", "true");

		fireEvent.click(product);
		// It starts to leave at once, hidden from assistive technology and out of the tab order, but it is
		// still on screen while it slides away.
		expect(panel).toHaveAttribute("data-state", "closed");
		expect(panel).toHaveAttribute("aria-hidden", "true");
		expect(panel).toHaveAttribute("inert");
		expect(document.body.contains(panel)).toBe(true);
		settle(400);
		expect(document.body.contains(panel)).toBe(false);
	});

	it("slides the search panel the same way", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		const panel = find('[data-panel="search"]') as HTMLElement;
		settle(30);
		expect(panel).toHaveAttribute("data-state", "open");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(panel).toHaveAttribute("data-state", "closed");
		expect(panel).toHaveAttribute("aria-hidden", "true");
		expect(document.body.contains(panel)).toBe(true);
		settle(400);
		expect(document.body.contains(panel)).toBe(false);
	});

	it("slides the phone menu the same way", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		fireEvent.click(menu);
		const panel = find('[data-panel="menu"]') as HTMLElement;
		settle(30);
		expect(panel).toHaveAttribute("data-state", "open");
		fireEvent.click(menu);
		expect(panel).toHaveAttribute("data-state", "closed");
		expect(panel).toHaveAttribute("inert");
		settle(400);
		expect(document.body.contains(panel)).toBe(false);
	});

	it("fades the dimmed page in and out", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.keyDown(document, { key: "k", ctrlKey: true });
		const backdrop = find("[data-backdrop]") as HTMLElement;
		expect(backdrop.className).toContain("opacity-0");
		settle(30);
		expect(backdrop).toHaveAttribute("data-state", "open");
		expect(backdrop.className).toContain("opacity-100");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(backdrop.className).toContain("opacity-0");
		settle(400);
		expect(document.body.contains(backdrop)).toBe(false);
	});

	it("opens the groups in the phone menu in place, one at a time, instead of popping", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		settle(30);
		const panel = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		const group = (name: string) =>
			panel
				.getByRole("button", { name })
				.parentElement?.querySelector("[data-panel='section']") as HTMLElement;
		expect(group("Product")).toHaveAttribute("data-state", "closed");
		fireEvent.click(panel.getByRole("button", { name: "Product" }));
		expect(group("Product")).toHaveAttribute("data-state", "open");
		expect(group("Product").className).toContain("grid-rows-[1fr]");
		fireEvent.click(panel.getByRole("button", { name: "Developers" }));
		expect(group("Product")).toHaveAttribute("data-state", "closed");
		expect(group("Product")).toHaveAttribute("aria-hidden", "true");
		expect(group("Developers")).toHaveAttribute("data-state", "open");
	});

	it("crossfades the hamburger into a cross, rather than swapping them", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		const [bars, cross] = [...menu.querySelectorAll("svg")] as SVGElement[];
		expect(menu.querySelectorAll("svg")).toHaveLength(2);
		expect(bars?.getAttribute("class")).toContain("opacity-100");
		expect(cross?.getAttribute("class")).toContain("opacity-0");
		fireEvent.click(menu);
		expect(bars?.getAttribute("class")).toContain("opacity-0");
		expect(cross?.getAttribute("class")).toContain("opacity-100");
	});

	it("moves nothing for anyone who asks their system for less motion: panels are gone at once", () => {
		const real = window.matchMedia;
		window.matchMedia = ((query: string) => ({
			matches: query.includes("reduce"),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia;
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		expect(find('[data-panel="search"]')).not.toBeNull();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(find('[data-panel="search"]')).toBeNull();
		window.matchMedia = real;
	});

	it("marks the links in the menus that leave the site with the same small arrow as the footer, and no others", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Developers" }));
		const inside = within(screen.getByRole("region", { name: "Developers" }));
		for (const name of ["Docs", "API", "SDK", "Machine Spec", "Templates", "GitHub"])
			expect(
				inside.getByRole("link", { name }).querySelector("svg[data-arrow=external]"),
				name,
			).not.toBeNull();
		for (const name of ["AI Index", "Skill File"])
			expect(inside.getByRole("link", { name }).querySelector("svg"), name).toBeNull();
	});
});

describe("the panels under the bar are glass, so there is no seam where the blur starts", () => {
	it("makes the dropdown and the bar behind it frosted glass on a desktop, blurring the same page as the rest of the screen, and solid only on a phone", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		const section = container.querySelector('[data-panel="dropdown"] > section') as HTMLElement;
		expect(section.className).toContain("xl:bg-black/");
		expect(section.className).toContain("xl:backdrop-blur-xl");
		expect(section.className).not.toMatch(/(^|\s)bg-black\/\d/);
		const solid = container.querySelector("[data-solid]") as HTMLElement;
		expect(solid.className).toContain("xl:bg-black/");
		expect(solid.className).toContain("xl:backdrop-blur-xl");
	});

	it("gives the search panel the same glass, and takes the scroll glass away while any panel is open so the two never stack", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		const fade = container.querySelector("[data-fade]") as HTMLElement;
		expect(fade.className).not.toContain("xl:opacity-0!");
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		const search = container.querySelector('[data-panel="search"] > section') as HTMLElement;
		expect(search.className).toContain("xl:backdrop-blur-xl");
		expect(fade.className).toContain("xl:opacity-0!");
	});
});
