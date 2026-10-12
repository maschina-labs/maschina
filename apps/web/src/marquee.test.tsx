import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";

const NAMES = ["Solana", "Jupiter", "Turnkey", "Helius", "Cloudflare", "PostgreSQL"];
const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) =>
	readFileSync(resolve(here, `../public/brand/stack/${name}.svg`), "utf8");
const section = () => screen.getByRole("region", { name: "Built With" });
/** The picture that carries a logo's name for a reader: the colored one, first in each item. */
const nameOf = (item: Element) => item.querySelector("[data-logo]")?.getAttribute("alt");

describe("the marquee", () => {
	it("says what it is, Built with, and lists the tech Maschina really runs on, in order, once each for a reader", () => {
		render(<Marquee />);
		expect(within(section()).getByText("Built with")).toBeInTheDocument();
		const list = within(section()).getByRole("list");
		expect(within(list).getAllByRole("listitem").map(nameOf)).toEqual(NAMES);
	});

	it("repeats the logos a second time so the loop has no gap, and hides that copy from assistive technology", () => {
		const { container } = render(<Marquee />);
		const copies = container.querySelectorAll("[data-copy]");
		expect(copies).toHaveLength(2);
		expect(copies[0]).not.toHaveAttribute("aria-hidden");
		expect(copies[1]).toHaveAttribute("aria-hidden", "true");
		const files = (copy?: Element) =>
			[...(copy?.querySelectorAll("img") ?? [])].map((image) => image.getAttribute("src"));
		expect(files(copies[1])).toEqual(files(copies[0]));
		for (const image of copies[1]?.querySelectorAll("img") ?? [])
			expect(image).toHaveAttribute("alt", "");
	});

	it("slides slowly and steadily to the left, stops under the mouse, and does not move at all for anyone who asked for less motion", () => {
		const { container } = render(<Marquee />);
		const track = container.querySelector("[data-track]") as HTMLElement;
		expect(track.className).toContain("animate-marquee");
		expect(track.className).toContain("motion-reduce:animate-none");
		expect(track.className).toContain("hover:[animation-play-state:paused]");
		expect((container.querySelectorAll("[data-copy]")[1] as HTMLElement).className).toContain(
			"motion-reduce:hidden",
		);
		expect(track.className).toContain("motion-reduce:flex-wrap");
		expect(track.className).toContain("motion-reduce:justify-center");
	});

	it("fades out toward both edges, and fills the width between the page margins", () => {
		const { container } = render(<Marquee />);
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.className).toMatch(/mask-image:linear-gradient\(to_right,transparent/);
		expect(section().className).toContain("px-(--gutter)");
		expect(section().className).toContain("bg-black");
	});

	it("shows each company's whole logo, the mark and its own wordmark together, from its own file, and no name typed in our type", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		expect(
			[...first.querySelectorAll("[data-logo]")].map((image) => image.getAttribute("src")),
		).toEqual(NAMES.map((name) => `/brand/stack/${name.toLowerCase()}.svg`));
		expect(container.querySelector("[data-word]")).toBeNull();
		for (const image of first.querySelectorAll("[data-logo]")) {
			expect(image).toHaveAttribute("height");
			expect(image).toHaveAttribute("width");
			expect(image).toHaveAttribute("decoding", "async");
		}
	});

	it("uses the companies' own published files, unmodified: Solana's gradient and wordmark, Jupiter's kit, Cloudflare's, Helius's and PostgreSQL's", () => {
		for (const name of NAMES) expect(read(name.toLowerCase()), name).toContain("<svg");
		expect(read("solana")).toContain("#9945FF");
		expect(read("solana")).toContain("#19FB9B");
		// Jupiter's own brand kit: the logo with its text for a dark page, and its own grayscale one.
		expect(read("jupiter")).toContain("#C7F284");
		expect(read("jupiter-gray")).not.toContain("#C7F284");
		expect(read("helius")).toContain("#E84125");
		// Cloudflare's own file for a dark page: the orange cloud with its wordmark in white.
		expect(read("cloudflare")).toContain("#f48120");
		expect(read("cloudflare")).toContain(".st0{fill:#fff}");
		// PostgreSQL's three color elephant, from the project's own wiki.
		expect(read("postgresql").toLowerCase()).toContain("#336791");
	});

	it("shows them gray and dim until you look at them, then the whole logo in its own colors, by a filter and not by editing the file", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		for (const item of first.querySelectorAll("li")) {
			expect(item.className, nameOf(item) ?? "").toContain("group");
			const logo = item.querySelector("[data-logo]") as HTMLElement;
			const gray = item.querySelector("[data-rest]") as HTMLElement | null;
			if (gray) {
				// A company that publishes its own grayscale logo: that file at rest, the colored one on hover.
				expect(gray.className).toContain("group-hover:opacity-0");
				expect(logo.className).toContain("opacity-0");
				expect(logo.className).toContain("group-hover:opacity-100");
			} else {
				for (const part of [
					"grayscale",
					"brightness-",
					"opacity-60",
					"group-hover:grayscale-0",
					"group-hover:opacity-100",
				])
					expect(logo.className, nameOf(item) ?? "").toContain(part);
			}
		}
	});

	it("uses Jupiter's own grayscale logo for its resting state, since Jupiter publishes one", () => {
		const { container } = render(<Marquee />);
		const jupiter = [...container.querySelectorAll("[data-copy] li")].find(
			(item) => nameOf(item) === "Jupiter",
		);
		expect(jupiter?.querySelector("[data-rest]")?.getAttribute("src")).toBe(
			"/brand/stack/jupiter-gray.svg",
		);
		const others = [
			...(container.querySelectorAll("[data-copy]")[0]?.querySelectorAll("[data-rest]") ?? []),
		];
		expect(others).toHaveLength(1);
	});

	it("is not a list of partners: no link, no claim, just what it is built with", () => {
		const { container } = render(<Marquee />);
		expect(container.querySelector("a")).toBeNull();
		expect(section().textContent ?? "").not.toMatch(
			/partner|trusted by|backed by|official|endorse/i,
		);
	});
});
