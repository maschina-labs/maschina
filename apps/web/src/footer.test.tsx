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
		await waitFor(() => expect(tx).toHaveAttribute("data-lit", "true"));
		await waitFor(() => expect(rx).toHaveAttribute("data-lit", "true"));
		// Each is a short blink, not a state that stays on.
		await waitFor(() => expect(tx).toHaveAttribute("data-lit", "false"));
		await waitFor(() => expect(rx).toHaveAttribute("data-lit", "false"));
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
		await waitFor(() => expect(tx).toHaveAttribute("data-lit", "true"));
		expect(rx).toHaveAttribute("data-lit", "false");
		await within(screen.getByRole("status")).findByText("API unreachable");
		expect(rx).toHaveAttribute("data-lit", "false");
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

	it("offers a language, and only the ones that exist", () => {
		render(<Footer />);
		const language = screen.getByRole("combobox", { name: "Language" });
		expect(
			within(language)
				.getAllByRole("option")
				.map((option) => option.textContent),
		).toEqual(["English"]);
	});

	it("makes the status and the language boxes the same height, and the same size of text", () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		const language = screen.getByRole("combobox", { name: "Language" });
		const box = language.closest("label") as HTMLElement;
		const height = (element: HTMLElement) =>
			element.className.match(/(?:^|\s)(h-\d+)(?:\s|$)/)?.[1];
		expect(height(status)).toBeDefined();
		expect(height(box)).toBe(height(status));
		const size = (element: HTMLElement) => element.className.match(/text-\[\d+px\]/)?.[0];
		expect(size(box)).toBe(size(status));
	});

	it("puts the status and the language together on the right of the line with the copyright", () => {
		render(<Footer />);
		const row = screen.getByText(/All rights reserved/).parentElement as HTMLElement;
		const right = screen.getByRole("status").parentElement as HTMLElement;
		expect(right).toBe(screen.getByRole("combobox", { name: "Language" }).closest("[data-right]"));
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
