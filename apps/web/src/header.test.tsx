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

	it("lists the pages a stranger needs", () => {
		render(<Header authUrl={AUTH} />);
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		for (const page of ["Machines", "Security", "Live record", "Developers", "Pricing"]) {
			expect(pages.getByRole("link", { name: page })).toBeInTheDocument();
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
		expect(open.getByRole("link", { name: "Security" })).toBeInTheDocument();
		expect(open.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `${AUTH}/sign-in`);

		fireEvent.click(menu);
		expect(screen.queryByRole("navigation", { name: "Pages, menu" })).toBeNull();
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
