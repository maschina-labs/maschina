import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";

const spot = (container: HTMLElement) => container.querySelector("[data-spot]") as SVGCircleElement;

describe("the footer", () => {
	// The status dot asks the API. Each test stands one in, so nothing here reaches the network.
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
		);
	});

	it("shows whether Maschina is up, from the API's own check", async () => {
		render(<Footer />);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent("Checking");
		expect(await within(status).findByText("All systems normal")).toBeInTheDocument();
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

	it("says who owns it, in the year it is now", () => {
		vi.useFakeTimers({ now: new Date("2031-03-01T12:00:00Z"), toFake: ["Date"] });
		render(<Footer />);
		expect(
			within(screen.getByRole("contentinfo")).getByText(
				"© 2031 Maschina Labs. All rights reserved.",
			),
		).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("maps the site in four columns, one of them for machines", () => {
		render(<Footer />);
		for (const name of ["Product", "Build", "Company", "Machines"]) {
			expect(screen.getByRole("navigation", { name })).toBeInTheDocument();
		}
		const machines = screen.getByRole("navigation", { name: "Machines" });
		expect(within(machines).getByRole("link", { name: "AI index" })).toBeInTheDocument();
	});

	it("keeps the legal pages on the copyright line", () => {
		render(<Footer />);
		const legal = screen.getByRole("navigation", { name: "Legal" });
		for (const page of ["Terms", "Privacy", "Risk", "Security", "License"]) {
			expect(within(legal).getByRole("link", { name: page })).toBeInTheDocument();
		}
	});

	it("opens with the mark and the socials", () => {
		render(<Footer />);
		const footer = within(screen.getByRole("contentinfo"));
		expect(footer.getByRole("img", { name: "Maschina mark" })).toBeInTheDocument();
		expect(footer.getByRole("link", { name: "Maschina on X" })).toHaveAttribute(
			"href",
			"https://x.com/maschinalabs",
		);
		expect(footer.getByRole("link", { name: "Maschina on GitHub" })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs/maschina",
		);
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
