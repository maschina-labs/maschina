import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";

const AUTH = "https://auth.maschina.dev";
const locked = () => document.documentElement.style.overflow === "hidden";

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

describe("the page cannot scroll behind an open header panel", () => {
	it("is free to scroll while nothing is open", () => {
		render(<Header authUrl={AUTH} />);
		expect(locked()).toBe(false);
	});

	it("locks while the phone menu is open and frees again when it closes", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(locked()).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(locked()).toBe(false);
	});

	it("locks while a dropdown is open, and while the search is open", () => {
		const first = render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		expect(locked()).toBe(true);
		first.unmount();
		expect(locked()).toBe(false);

		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		expect(locked()).toBe(true);
		fireEvent.keyDown(document, { key: "Escape" });
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(locked()).toBe(false);
	});

	it("gives the page back its own setting, and leaves nothing behind, when the header goes away", () => {
		document.documentElement.style.overflow = "scroll";
		const view = render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(document.documentElement.style.overflow).toBe("hidden");
		view.unmount();
		expect(document.documentElement.style.overflow).toBe("scroll");
		document.documentElement.style.overflow = "";
	});
});

describe("the open panels still scroll on their own, since only the page behind them is locked", () => {
	const SCROLLS = ["overflow-y-auto", "overscroll-contain", "max-h-[calc(100dvh-5.5rem)]"];

	it("scrolls the phone menu's list", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		const list = screen.getByRole("navigation", { name: "Pages, menu" });
		for (const part of SCROLLS) expect(list.className).toContain(part);
	});

	it("scrolls the search results, which can be longer than the screen", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		const panel = screen.getByRole("region", { name: "Search" }).firstElementChild as HTMLElement;
		for (const part of SCROLLS) expect(panel.className).toContain(part);
	});

	it("scrolls a dropdown's contents too", () => {
		render(<Header authUrl={AUTH} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Product" }));
		const panel = screen.getByRole("region", { name: "Product" }).firstElementChild as HTMLElement;
		for (const part of SCROLLS) expect(panel.className).toContain(part);
	});
});
