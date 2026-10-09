import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the header", () => {
	it("is the wordmark, and it leads home", () => {
		render(<Header authUrl={AUTH} />);
		const home = within(screen.getByRole("banner")).getByRole("link", { name: "Maschina, home" });
		expect(home).toHaveAttribute("href", "/");
		expect(within(home).getByRole("img", { name: "Maschina" })).toHaveAttribute(
			"src",
			"/brand/wordmark.svg",
		);
	});

	it("leads to sign in and sign up, wherever auth lives", () => {
		render(<Header authUrl="http://localhost:3001" />);
		const header = within(screen.getByRole("banner"));
		expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"http://localhost:3001/sign-in",
		);
		expect(header.getByRole("link", { name: "Sign up" })).toHaveAttribute(
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
			"Live record",
			"Pricing",
		]);
	});

	it("opens a dropdown from three of them, and links straight to the other two", () => {
		render(<Header authUrl={AUTH} />);
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		for (const name of ["Product", "Developers", "Company"]) {
			const trigger = pages.getByRole("button", { name });
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		}
		for (const name of ["Live record", "Pricing"]) {
			const link = pages.getByRole("link", { name });
			expect(link.querySelector("svg")).toBeNull();
		}
	});

	it("opens on hover, full width, with the big links on the left and the small ones beside them", () => {
		render(<Header authUrl={AUTH} />);
		expect(screen.queryByRole("region", { name: "Developers" })).toBeNull();

		fireEvent.mouseEnter(screen.getByRole("button", { name: "Developers" }));
		const panel = screen.getByRole("region", { name: "Developers" });
		expect(panel.className).toContain("inset-x-0");
		const inside = within(panel);
		for (const name of ["Docs", "API", "SDK", "Machine spec", "Templates"]) {
			expect(inside.getByRole("link", { name })).toBeInTheDocument();
		}
		expect(inside.getByRole("link", { name: "GitHub" })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs/maschina",
		);
		for (const name of ["Status", "AI index", "Skill file", "MCP server"]) {
			expect(inside.getByRole("link", { name })).toBeInTheDocument();
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
		for (const name of ["About", "Roadmap", "Changelog", "News", "Contact"]) {
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

	it("takes a solid background while a dropdown is open, so the two read as one piece", () => {
		render(<Header authUrl={AUTH} />);
		const header = screen.getByRole("banner");
		expect(header.className).not.toContain("bg-black");
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		expect(header.className).toContain("bg-black");
	});

	it("folds the pages into a menu on a phone, and opens and closes it", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();

		fireEvent.click(menu);
		expect(menu).toHaveAttribute("aria-expanded", "true");
		const open = within(screen.getByRole("navigation", { name: "Pages, menu" }));
		expect(open.getByRole("link", { name: "Live record" })).toBeInTheDocument();
		expect(open.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `${AUTH}/sign-in`);
		expect(open.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `${AUTH}/sign-up`);

		fireEvent.click(menu);
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();
	});

	it("shows sign in and sign up as buttons only on a wide screen", () => {
		render(<Header authUrl={AUTH} />);
		for (const name of ["Sign in", "Sign up"]) {
			const link = within(screen.getByRole("banner")).getByRole("link", { name });
			expect(link.className).toContain("hidden");
			expect(link.className).toContain("lg:inline-block");
		}
	});

	it("is a hamburger in a box of its own on a phone: an icon, no words", () => {
		render(<Header authUrl={AUTH} />);
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu).toHaveAttribute("aria-label", "Menu");
		expect(menu.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		expect(menu).toHaveTextContent("");
		expect(menu.className).toContain("lg:hidden");
	});

	it("is sticky: it stays at the top of the screen as the page scrolls", () => {
		render(<Header authUrl={AUTH} />);
		expect(screen.getByRole("banner").className).toContain("fixed");
	});

	it("gets a solid background once the page scrolls, so nothing runs through it", () => {
		render(<Header authUrl={AUTH} />);
		const header = screen.getByRole("banner");
		expect(header.className).not.toContain("bg-black");

		Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
		fireEvent.scroll(window);
		expect(header.className).toContain("bg-black");

		Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
		fireEvent.scroll(window);
		expect(header.className).not.toContain("bg-black");
	});

	it("keeps to the shared page margin, with no rounded corners", () => {
		const { container } = render(<Header authUrl={AUTH} />);
		expect(container.innerHTML).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
