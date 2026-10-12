import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";
import { readPreference, savePreference } from "./preferences.ts";
import { PreferencesToast } from "./preferences-toast.tsx";

const clearCookie = () => {
	// biome-ignore lint/suspicious/noDocumentCookie: a test sets and clears the cookie by hand
	document.cookie = "maschina_preferences=; Max-Age=0; Path=/";
};

beforeEach(() => {
	clearCookie();
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => {
	clearCookie();
	vi.unstubAllGlobals();
});

describe("the saved choice", () => {
	it("is nothing until one is made, then accepted or declined, kept in one first party cookie for a year", () => {
		expect(readPreference()).toBeNull();
		savePreference("accepted");
		expect(readPreference()).toBe("accepted");
		expect(document.cookie).toContain("maschina_preferences=accepted");
		savePreference("declined");
		expect(readPreference()).toBe("declined");
	});

	it("writes the cookie for the whole site, a year long, and only marks it Secure where the page is", () => {
		const set = vi.spyOn(document, "cookie", "set");
		savePreference("accepted");
		const written = String(set.mock.calls.at(-1)?.[0]);
		expect(written).toContain("Path=/");
		expect(written).toContain("Max-Age=31536000");
		expect(written).toContain("SameSite=Lax");
		// jsdom's page is plain http, so there is no Secure here; on https the flag is added.
		expect(written).not.toContain("Secure");
		set.mockRestore();
	});

	it("ignores a cookie that holds anything else", () => {
		// biome-ignore lint/suspicious/noDocumentCookie: a test sets the cookie by hand
		document.cookie = "maschina_preferences=maybe; Path=/";
		expect(readPreference()).toBeNull();
	});
});

describe("the preferences toast", () => {
	const open = () => act(() => void window.dispatchEvent(new Event("maschina:preferences")));

	it("is not on the page until it is asked for", () => {
		render(<PreferencesToast />);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("opens at the bottom center when asked, a small square panel, with the two choices and nothing else", () => {
		render(<PreferencesToast />);
		open();
		const toast = screen.getByRole("dialog", { name: "Cookie preferences" });
		for (const part of [
			"fixed",
			"bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
			"left-1/2",
			"-translate-x-1/2",
		])
			expect(toast.className).toContain(part);
		expect(toast.className).not.toMatch(/rounded/);
		const buttons = within(toast).getAllByRole("button");
		expect(buttons.map((button) => button.textContent)).toEqual(["Decline", "Accept"]);
		// Accept is the pearl button, Decline the gray one, the same two as the rest of the site.
		expect(buttons[1]?.className).toContain("silver-button");
		expect(buttons[0]?.className).toContain("bg-white/[0.13]");
		expect(toast.querySelectorAll("a")).toHaveLength(0);
	});

	it("says in plain words what it asks, and does not claim anything that is not so", () => {
		render(<PreferencesToast />);
		open();
		const toast = screen.getByRole("dialog");
		expect(toast.textContent).toMatch(/essential cookies/i);
		expect(toast.textContent).toMatch(/optional cookies/i);
		// What Accept turns on, named: the analytics the privacy policy describes, and nothing else.
		expect(toast.textContent).toMatch(/PostHog/);
		expect(toast.textContent).toMatch(/pages you open/i);
		expect(toast.textContent).not.toMatch(/advertis/i);
		expect(toast.textContent ?? "").not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]|!`),
		);
	});

	it("saves Accept, and Decline, closes, and shows nothing more", () => {
		render(<PreferencesToast />);
		open();
		fireEvent.click(screen.getByRole("button", { name: "Accept" }));
		expect(readPreference()).toBe("accepted");
		expect(screen.queryByRole("dialog")).toBeNull();
		open();
		fireEvent.click(screen.getByRole("button", { name: "Decline" }));
		expect(readPreference()).toBe("declined");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows the choice already made, so reopening it is not a surprise", () => {
		savePreference("declined");
		render(<PreferencesToast />);
		open();
		expect(screen.getByText("Your choice: declined")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Accept" }));
		open();
		expect(screen.getByText("Your choice: accepted")).toBeInTheDocument();
	});

	it("closes on Escape without saving anything", () => {
		render(<PreferencesToast />);
		open();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(readPreference()).toBeNull();
	});
});

describe("the preferences link in the footer", () => {
	it("is the last of the legal links, a button and not a page, and it opens the toast", () => {
		render(
			<>
				<Footer />
				<PreferencesToast />
			</>,
		);
		const sitemap = screen.getByRole("navigation", { name: "Sitemap" });
		const legal = within(sitemap).getByRole("heading", { name: "Legal" })
			.parentElement as HTMLElement;
		const items = within(legal).getAllByRole("listitem");
		expect(items.at(-1)).toHaveTextContent("Preferences");
		const button = within(legal).getByRole("button", { name: "Preferences" });
		expect(button.querySelector("a")).toBeNull();
		expect(screen.queryByRole("dialog")).toBeNull();
		fireEvent.click(button);
		expect(screen.getByRole("dialog", { name: "Cookie preferences" })).toBeInTheDocument();
	});
});
