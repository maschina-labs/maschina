import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		expect(pages.getAllByRole("link").map((link) => link.textContent)).toEqual([
			"Product",
			"Developers",
			"Live record",
			"Pricing",
			"Company",
		]);
	});

	it("marks the pages that will open a dropdown with a caret, and only those", () => {
		render(<Header authUrl={AUTH} />);
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		for (const name of ["Product", "Developers", "Company"]) {
			expect(pages.getByRole("link", { name }).querySelector("svg")).toHaveAttribute(
				"aria-hidden",
				"true",
			);
		}
		for (const name of ["Live record", "Pricing"]) {
			expect(pages.getByRole("link", { name }).querySelector("svg")).toBeNull();
		}
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
