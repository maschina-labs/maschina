import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";

const spot = (container: HTMLElement) => container.querySelector("[data-spot]") as SVGCircleElement;

describe("the footer", () => {
	// The status mark asks the API. Each test stands one in, so nothing here reaches the network.
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
		);
	});
	afterEach(() => vi.useRealTimers());

	it("shows whether Maschina is up, from the API's own check", async () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent("Checking");
		expect(await within(status).findByText("All systems normal")).toBeInTheDocument();
	});

	it("blinks TX when it asks the API and RX when the answer comes back, then goes dark", async () => {
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
		await within(screen.getByRole("status")).findByText("API unreachable");
		expect(rx).toHaveAttribute("data-on", "false");
	});

	it("says so when the stop switch is on", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							status: "ok",
							halt: { reason: "upgrading", since: "2026-10-09T00:00:00Z" },
						}),
						{ status: 200 },
					),
			),
		);
		render(<Footer />);
		expect(
			await within(screen.getByRole("status")).findByText("Machines paused"),
		).toBeInTheDocument();
	});

	it("opens a popover above the language button, with only the languages that exist", () => {
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
		expect(options.map((option) => option.textContent)).toEqual(["English"]);
		expect(options[0]).toHaveAttribute("aria-selected", "true");
		// The footer is at the foot of the page, so it opens upward, square, and tied to the box.
		expect(list.parentElement?.className).toContain("bottom-full");
		expect(list.parentElement?.className).toContain("right-0");
		expect(list.parentElement?.innerHTML).not.toMatch(/rounded/);
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
			expect(link.className).not.toMatch(/rounded/);
			expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		}
		expect(screen.getByRole("status").className).toContain("h-9");
	});

	it("puts the status and the language together on the right of the line with the copyright", () => {
		render(<Footer />);
		const row = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		const right = screen.getByRole("status").parentElement as HTMLElement;
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
		const line = screen.getByText("© 2031 Maschina Labs. All rights reserved.");
		expect(line.className).toContain("text-center");
		// It comes before the wordmark, so it sits above it.
		const logo = screen.getByRole("img", { name: "Maschina" }).parentElement as HTMLElement;
		const row = line.parentElement as HTMLElement;
		expect(footer.firstElementChild).toBe(row);
		expect(row.nextElementSibling).toBe(logo);
	});

	it("keeps to the shared page margin", () => {
		render(<Footer />);
		expect(screen.getByRole("contentinfo").className).toContain("px-(--gutter)");
	});

	it("is a full screen with the wordmark at the foot of it", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("min-h-dvh");
		expect(className).toContain("flex-col");
		expect(className).toContain("justify-end");
	});

	it("sits above the hero, with its own edge, so it rolls up over it", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
		expect(className).toContain("border-t");
		expect(className).toContain("bg-black");
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
