import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";
import { leavesSite } from "./routes.ts";

const spot = (container: HTMLElement) => container.querySelector("[data-spot]") as SVGCircleElement;

/** What the status page's feed answers when every service is in this state. */
const feed = (state: string, status = 200) =>
	vi.fn(
		async () =>
			new Response(JSON.stringify({ data: { attributes: { aggregate_state: state } } }), {
				status,
			}),
	);

describe("the footer", () => {
	// The status mark asks the status page's feed. Each test stands one in, so nothing here reaches the network.
	beforeEach(() => {
		vi.stubGlobal("fetch", feed("operational"));
	});
	afterEach(() => vi.useRealTimers());

	it("shows whether Maschina is up, from the status page's own feed, and the mark links to the status page", async () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent("Checking");
		expect(await within(status).findByText("All systems normal")).toBeInTheDocument();
		expect(status.closest("a")).toHaveAttribute("href", "https://status.maschina.dev");
	});

	it("has the logo on the left, level with the sitemap's column headers, linking home", () => {
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const home = within(footer).getByRole("link", { name: "Maschina, home" });
		expect(home).toHaveAttribute("href", "/");
		expect(home.querySelectorAll("img")).toHaveLength(2);
		for (const image of home.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
		// The logo and the columns are one row: the logo first, the columns after, both starting at the top.
		const nav = within(footer).getByRole("navigation", { name: "Sitemap" });
		const row = home.parentElement as HTMLElement;
		expect(nav.parentElement).toBe(row);
		expect(row.firstElementChild).toBe(home);
		expect(row.lastElementChild).toBe(nav);
		expect(row.className).toContain("sm:flex-row");
		expect(row.className).toContain("sm:items-start");
		expect(row.className).toContain("sm:justify-between");
		// Only a little room at the top: the footer is as tall as its content, not a screen with empty space above it.
		expect(footer.className).toContain("pt-16");
		expect(footer.className).not.toContain("pt-32");
	});

	it("has the same logo as the header, with the mark that turns a full turn each time the cursor arrives", () => {
		render(<Footer />);
		const home = within(screen.getByRole("contentinfo")).getByRole("link", {
			name: "Maschina, home",
		});
		expect(home.querySelector("[data-word] img")).toHaveAttribute("src", "/brand/word.svg");
		const mark = home.querySelector("[data-mark]") as HTMLElement;
		expect(mark).toHaveAttribute("src", "/brand/favicon.svg");
		expect(mark.style.transform).toBe("rotate(0deg)");
		fireEvent.pointerEnter(mark);
		expect(mark.style.transform).toBe("rotate(360deg)");
		fireEvent.pointerLeave(mark);
		expect(mark.style.transform).toBe("rotate(360deg)");
	});

	it("lights TX amber and RX green, so the two directions can be told apart", async () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		const tx = within(status).getByText("TX").parentElement as HTMLElement;
		const rx = within(status).getByText("RX").parentElement as HTMLElement;
		// A blink is short and a slow machine can miss it between two checks, so every change is written down as it happens.
		const seen = { tx: "", rx: "" };
		const note = () => {
			if (tx.getAttribute("data-on") === "true") seen.tx = tx.firstElementChild?.className ?? "";
			if (rx.getAttribute("data-on") === "true") seen.rx = rx.firstElementChild?.className ?? "";
		};
		const watch = new MutationObserver(note);
		watch.observe(status, { attributes: true, childList: true, subtree: true });
		note();
		await waitFor(
			() => {
				expect(seen.tx).toContain("oklch(0.82_0.17_70)");
				expect(seen.rx).toContain("oklch(0.8_0.2_145)");
			},
			{ timeout: 4000 },
		);
		watch.disconnect();
	});

	it("never lights TX and RX at the same moment, even when the answer is instant", async () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		const tx = within(status).getByText("TX").parentElement as HTMLElement;
		const rx = within(status).getByText("RX").parentElement as HTMLElement;
		let both = false;
		let txSeen = false;
		let rxSeen = false;
		// Every change is written down as it happens, so a slow machine cannot step over a short blink.
		const note = () => {
			const t = tx.getAttribute("data-on") === "true";
			const r = rx.getAttribute("data-on") === "true";
			txSeen ||= t;
			rxSeen ||= r;
			both ||= t && r;
		};
		const watch = new MutationObserver(note);
		watch.observe(status, { attributes: true, childList: true, subtree: true });
		note();
		await waitFor(() => expect(txSeen && rxSeen).toBe(true), { timeout: 4000 });
		// Let the blinks end, so a late overlap would show.
		await new Promise((resolve) => setTimeout(resolve, 500));
		watch.disconnect();
		expect(both).toBe(false);
	});

	it("has the sitemap: five columns on the right, with the pages in each left aligned", () => {
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const nav = within(footer).getByRole("navigation", { name: "Sitemap" });
		expect(
			within(nav)
				.getAllByRole("heading", { level: 2 })
				.map((heading) => heading.textContent),
		).toEqual(["Product", "Developers", "Resources", "Company", "Legal"]);
		// The columns sit together at the right end of the row, up to the margin, with an even gap between
		// them. Inside each column the pages are left aligned.
		expect(nav.className).toContain("sm:flex");
		expect(nav.className).toContain("sm:gap-x-[clamp(2rem,5vw,6rem)]");
		expect(nav.className).not.toContain("text-center");
		const headings = within(nav).getAllByRole("heading", { level: 2 });
		for (const heading of headings) expect(heading.parentElement?.className).toContain("text-left");
		expect(nav.innerHTML).not.toMatch(/rounded/);
		expect(within(nav).getByRole("link", { name: "Docs" })).toHaveAttribute(
			"href",
			"https://docs.maschina.dev",
		);
		expect(within(nav).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
	});

	it("has light headers over grayed pages that light up on hover", () => {
		render(<Footer />);
		const nav = within(screen.getByRole("navigation", { name: "Sitemap" }));
		for (const heading of nav.getAllByRole("heading", { level: 2 })) {
			expect(heading.className).toContain("text-white");
			// In capitals on screen, but written in sentence case, so the names stay as they are.
			expect(heading.className).toContain("uppercase");
			expect(heading.textContent).not.toBe(heading.textContent?.toUpperCase());
		}
		for (const link of nav.getAllByRole("link")) {
			expect(link.className).toContain("text-neutral-500");
			expect(link.className).toContain("hover:text-white");
		}
	});

	it("marks the links that leave the site with a small up-right arrow, and no others", () => {
		render(<Footer />);
		const nav = within(screen.getByRole("navigation", { name: "Sitemap" }));
		for (const name of ["GitHub", "X", "Changelog"]) {
			const link = nav.getByRole("link", { name });
			expect(link.querySelector("svg")).toHaveAttribute("data-arrow", "external");
			expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
			// The arrow takes its color from the link: gray like the words, and light with them on hover.
			const arrow = link.querySelector("svg");
			expect(arrow?.getAttribute("class")).not.toMatch(/\btext-/);
			// Phosphor draws in the current color, so the arrow is whatever color the link is.
			expect(arrow).toHaveAttribute("fill", "currentColor");
			expect(link.className).toContain("text-neutral-500");
			expect(link.className).toContain("hover:text-white");
		}
		for (const link of nav.getAllByRole("link")) {
			// What leaves the site: another address. The plain files are endpoints of this site and get no arrow.
			const href = link.getAttribute("href") ?? "";
			expect(link.querySelector("svg") !== null, href).toBe(leavesSite(href));
		}
	});

	it("shows the pages that are not built as dimmed text tagged Soon, never as links", () => {
		render(<Footer />);
		const nav = within(screen.getByRole("navigation", { name: "Sitemap" }));
		expect(nav.queryByRole("link", { name: /Marketplace/ })).toBeNull();
		const item = nav.getByText("Marketplace").closest("li") as HTMLElement;
		expect(item).toHaveTextContent("Soon");
		expect(item.className).toMatch(/text-neutral-(600|700)/);
	});

	it("puts the logo and sitemap row above the copyright line, in the middle of the free room", () => {
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const nav = within(footer).getByRole("navigation", { name: "Sitemap" });
		const row = nav.parentElement as HTMLElement;
		const line = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		const order = [...footer.children];
		expect(order.indexOf(row)).toBeLessThan(order.indexOf(line));
		expect(row.className).not.toContain("my-auto");
	});

	it("gives the sitemap room to breathe: space above and below the row, and between the pages", () => {
		render(<Footer />);
		const nav = screen.getByRole("navigation", { name: "Sitemap" });
		expect((nav.parentElement as HTMLElement).className).toContain("py-12");
		expect(within(nav).getAllByRole("list")[0]?.className).toContain("gap-2.5");
		const line = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		expect(line.className).toContain("pb-8");
	});

	it("blinks TX when it asks the status page and RX when the answer comes back, then goes dark", async () => {
		render(<Footer />);
		const status = within(screen.getByRole("status"));
		const tx = status.getByText("TX").parentElement as HTMLElement;
		const rx = status.getByText("RX").parentElement as HTMLElement;
		// The first check goes out as soon as the page is up.
		await waitFor(() => expect(tx).toHaveAttribute("data-on", "true"));
		await waitFor(() => expect(rx).toHaveAttribute("data-on", "true"));
		// Each is a short blink, not a state that stays on.
		await waitFor(() => expect(tx).toHaveAttribute("data-on", "false"));
		await waitFor(() => expect(rx).toHaveAttribute("data-on", "false"));
	});

	it("shows the status dot as green when up, yellow when paused, and red when down: never orange", async () => {
		const dot = () => screen.getByRole("status").querySelector("span") as HTMLElement;
		const { unmount } = render(<Footer />);
		await within(screen.getByRole("status")).findByText("All systems normal");
		expect(dot().className).toContain("oklch(0.8_0.2_145)");
		// Green and red blink, like a link light; yellow, while paused, stays steady. Not for reduced motion.
		expect(dot().className).toContain("animate-blink");
		expect(dot().className).toContain("motion-reduce:animate-none");
		unmount();
		vi.stubGlobal("fetch", feed("maintenance"));
		const paused = render(<Footer />);
		await within(screen.getByRole("status")).findByText("Under maintenance");
		expect(dot().className).toContain("oklch(0.86_0.17_100)");
		expect(dot().className).not.toContain("animate-blink");
		paused.unmount();
		vi.stubGlobal("fetch", feed("downtime"));
		render(<Footer />);
		await within(screen.getByRole("status")).findByText("Some systems down");
		expect(dot().className).toContain("oklch(0.62_0.24_25)");
		expect(dot().className).toContain("animate-blink");
	});

	it("never lights RX when nothing comes back", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network");
			}),
		);
		render(<Footer />);
		const status = within(screen.getByRole("status"));
		const tx = status.getByText("TX").parentElement as HTMLElement;
		const rx = status.getByText("RX").parentElement as HTMLElement;
		await waitFor(() => expect(tx).toHaveAttribute("data-on", "true"));
		expect(rx).toHaveAttribute("data-on", "false");
		await within(screen.getByRole("status")).findByText("Checking");
		expect(rx).toHaveAttribute("data-on", "false");
	});

	it("says so when the status page announces maintenance", async () => {
		vi.stubGlobal("fetch", feed("maintenance"));
		render(<Footer />);
		expect(
			await within(screen.getByRole("status")).findByText("Under maintenance"),
		).toBeInTheDocument();
	});

	it("opens a popover above the language button, listing the languages", () => {
		render(<Footer />);
		const button = screen.getByRole("button", { name: "Language" });
		expect(button).toHaveTextContent("EN");
		expect(button).toHaveAttribute("aria-haspopup", "listbox");
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("listbox")).toBeNull();
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		const list = screen.getByRole("listbox", { name: "Language" });
		const options = within(list).getAllByRole("option");
		const names = options.map((option) => option.querySelector("[data-name]")?.textContent);
		// English first, then the world's most used languages, each under its own name.
		expect(names[0]).toBe("English");
		expect(names).toEqual(
			expect.arrayContaining([
				"Español",
				"Français",
				"Deutsch",
				"Português",
				"日本語",
				"한국어",
				"العربية",
				"हिन्दी",
			]),
		);
		expect(new Set(names).size).toBe(names.length);
		expect(options[0]).toHaveAttribute("aria-selected", "true");
		expect(
			options.filter((option) => option.getAttribute("aria-selected") === "true"),
		).toHaveLength(1);
		// A long list scrolls inside the popover, not off the screen.
		expect(list.className).toContain("overflow-y-auto");
		expect(list.className).toMatch(/max-h-/);
		// The footer is at the foot of the page, so it opens upward, square, and tied to the box.
		expect(list.parentElement?.className).toContain("bottom-full");
		expect(list.parentElement?.className).toContain("right-0");
		expect(list.parentElement?.innerHTML).not.toMatch(/rounded/);
	});

	it("puts a small square box at the right of each language, with a check in the one that is chosen", () => {
		render(<Footer />);
		fireEvent.click(screen.getByRole("button", { name: "Language" }));
		const list = screen.getByRole("listbox", { name: "Language" });
		const options = within(list).getAllByRole("option");
		for (const option of options) {
			const box = option.querySelector("[data-box]") as HTMLElement;
			expect(box).not.toBeNull();
			// The box is on the right, at the end of the row, inside the option: the whole row is one click.
			expect(option.lastElementChild).toBe(box);
			expect(box.className).not.toMatch(/rounded/);
			const chosen = option.getAttribute("aria-selected") === "true";
			expect(box.querySelector("svg") !== null).toBe(chosen);
		}
	});
	it("closes the popover on Escape, on a click elsewhere, and on choosing a language", async () => {
		render(<Footer />);
		const button = screen.getByRole("button", { name: "Language" });
		const closed = () => waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		fireEvent.click(button);
		fireEvent.keyDown(document, { key: "Escape" });
		await closed();
		expect(button).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(button);
		fireEvent.pointerDown(document.body);
		await closed();
		fireEvent.click(button);
		fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "English" }));
		await closed();
		// Focus goes back to the button, so keyboard use carries on from where it was.
		expect(button).toHaveFocus();
	});

	it("does not close when the click is inside the popover or on the button itself", () => {
		render(<Footer />);
		const button = screen.getByRole("button", { name: "Language" });
		fireEvent.click(button);
		fireEvent.pointerDown(button);
		fireEvent.pointerDown(screen.getByRole("listbox"));
		expect(screen.getByRole("listbox")).toBeInTheDocument();
		// A second click on the button is what closes it.
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "false");
	});

	it("makes the status and the language boxes the same height, and the same size of text", () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		const box = screen.getByRole("button", { name: "Language" });
		const height = (element: HTMLElement) =>
			element.className.match(/(?:^|\s)(h-\d+)(?:\s|$)/)?.[1];
		expect(height(status)).toBeDefined();
		expect(height(box)).toBe(height(status));
		const size = (element: HTMLElement) => element.className.match(/text-\[\d+px\]/)?.[0];
		expect(size(box)).toBe(size(status));
	});

	it("has Maschina on X, GitHub and YouTube on the left, as square boxes the height of the status", () => {
		render(<Footer />);
		const row = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		const x = screen.getByRole("link", { name: "Maschina on X" });
		const github = screen.getByRole("link", { name: "Maschina on GitHub" });
		expect(x).toHaveAttribute("href", "https://x.com/maschinalabs");
		expect(github).toHaveAttribute("href", "https://github.com/maschina-labs/maschina");
		const youtube = screen.getByRole("link", { name: "Maschina on YouTube" });
		expect(youtube).toHaveAttribute("href", "https://www.youtube.com/@MaschinaLabs");
		const left = x.parentElement as HTMLElement;
		expect(left).toBe(github.parentElement);
		expect(left).toBe(youtube.parentElement);
		// In this order: X, GitHub, YouTube.
		expect([...left.children]).toEqual([x, github, youtube]);
		expect(left).toHaveAttribute("data-left");
		expect(left.className).toContain("sm:col-start-1");
		expect(left.className).toContain("sm:justify-self-start");
		// The left comes first in the line, then the copyright, then the right.
		expect(row.firstElementChild).toBe(left);
		for (const link of [x, github, youtube]) {
			expect(link.className).toContain("size-9");
			// The icons are white.
			expect(link.className).toContain("text-white");
			expect(link.className).not.toMatch(/rounded/);
			expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		}
		expect(screen.getByRole("status").className).toContain("h-9");
	});

	it("puts the status and the language together on the right of the line with the copyright", () => {
		render(<Footer />);
		const row = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		// The status mark is a link to the status page, so its parent is the link and the right side is above it.
		const right = screen.getByRole("status").closest("[data-right]") as HTMLElement;
		expect(right).toBe(screen.getByRole("button", { name: "Language" }).closest("[data-right]"));
		expect(row.contains(right)).toBe(true);
		expect(right.className).toContain("sm:justify-self-end");
		// The copyright is still centered, between them.
		expect(screen.getByText(/All rights reserved/).className).toContain("text-center");
		expect(row.className).toContain("sm:grid-cols-[1fr_auto_1fr]");
		expect(row.innerHTML).not.toMatch(/rounded/);
	});

	it("has the copyright centered above the wordmark, with the current year", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2031-03-04T12:00:00Z"));
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const line = screen.getByText("© 2031 Maschina, Corp. All rights reserved.");
		expect(line.className).toContain("text-center");
		// It comes before the wordmark, so it sits above it.
		const logo = screen.getByRole("img", { name: "Maschina" }).parentElement as HTMLElement;
		const row = line.parentElement as HTMLElement;
		expect(footer.contains(row)).toBe(true);
		expect(row.nextElementSibling).toBe(logo);
	});

	it("keeps to the shared page margin", () => {
		render(<Footer />);
		expect(screen.getByRole("contentinfo").className).toContain("px-(--gutter)");
	});

	it("is at least a screen tall, with the sitemap near the top and the line and wordmark at the foot, so any spare height sits between them, not above the sitemap", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("min-h-lvh");
		expect(className).not.toContain("justify-end");
		const line = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		expect(line.className).toContain("mt-auto");
		expect(className).toContain("flex-col");
	});

	it("is an ordinary section on black with no line along its top: it scrolls into view and covers nothing", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("relative");
		expect(className).not.toContain("z-10");
		expect(className).toContain("bg-black");
		// The line along the top, where it met the closing section, is gone.
		expect(className).not.toMatch(/\bborder/);
	});

	it("carries the wordmark, named once for screen readers", () => {
		render(<Footer />);
		expect(screen.getByRole("img", { name: "Maschina" })).toBeInTheDocument();
	});

	it("draws the wordmark once, as outlines, with a lit copy for the cursor", () => {
		const { container } = render(<Footer />);
		expect(container.querySelectorAll("[data-layer]")).toHaveLength(2);
		// The eight letters, without the mark.
		expect(container.querySelectorAll("[data-layer] path")).toHaveLength(16);
	});

	it("lights the edges under the cursor, and lets them fade when it leaves", () => {
		const { container } = render(<Footer />);
		const svg = screen.getByRole("img", { name: "Maschina" });
		const [x = 0, y = 0, width = 1, height = 1] = (svg.getAttribute("viewBox") ?? "")
			.split(" ")
			.map(Number);
		svg.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 1000, height: 1000 * (height / width) }) as DOMRect;
		const lit = container.querySelector("[data-lit]") as SVGGElement;

		expect(lit.style.opacity).toBe("0");
		// The middle of the drawing, in screen pixels, is the middle of the drawing in its own units.
		fireEvent.pointerMove(svg, { clientX: 500, clientY: 500 * (height / width) });
		expect(Number(spot(container).getAttribute("cx"))).toBeCloseTo(x + width / 2);
		expect(Number(spot(container).getAttribute("cy"))).toBeCloseTo(y + height / 2);
		expect(lit.style.opacity).toBe("1");

		fireEvent.pointerLeave(svg);
		expect(lit.style.opacity).toBe("0");
	});
});
