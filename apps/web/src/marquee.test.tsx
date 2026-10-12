import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";
import { STACK_RUNS_ON, STACK_WRITTEN_WITH } from "./stack.ts";

/** What is really used, pinned here so nothing is added to the wall that the repository does not use. */
const RUNS_ON = [
	"Solana",
	"Jupiter",
	"Helius",
	"Turnkey",
	"Cloudflare",
	"PostgreSQL",
	"Better Auth",
	"Sentry",
	"Docker",
	"Node.js",
	"PostHog",
];
const WRITTEN_WITH = [
	"TypeScript",
	"React",
	"TanStack",
	"Tailwind CSS",
	"Vite",
	"Hono",
	"Drizzle ORM",
	"Zod",
	"three.js",
	"shadcn/ui",
	"Radix UI",
	"Turborepo",
	"pnpm",
	"Vitest",
	"Biome",
];
const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) =>
	readFileSync(resolve(here, `../public/brand/stack/${name}.svg`), "utf8");
const section = () => screen.getByRole("region", { name: "Built With" });
/** The picture that carries a logo's name for a reader: the colored one, first in each item. */
const nameOf = (item: Element) => item.querySelector("[data-logo]")?.getAttribute("alt");

describe("the marquee", () => {
	it("says what it is, Built with, and has two rows: what Maschina runs on, and what it is written with", () => {
		render(<Marquee />);
		expect(within(section()).getByText("Built with")).toBeInTheDocument();
		const [first, second] = within(section()).getAllByRole("list");
		expect(
			within(first as HTMLElement)
				.getAllByRole("listitem")
				.map(nameOf),
		).toEqual(RUNS_ON);
		expect(
			within(second as HTMLElement)
				.getAllByRole("listitem")
				.map(nameOf),
		).toEqual(WRITTEN_WITH);
	});

	it("lists only what the repository uses: no AI model, since the people who use Maschina bring their own keys", () => {
		const names = [...STACK_RUNS_ON, ...STACK_WRITTEN_WITH].map((logo) => logo.name);
		expect(names).toEqual([...RUNS_ON, ...WRITTEN_WITH]);
		expect(names.join(" ")).not.toMatch(/anthropic|openai|claude|gpt|gemini/i);
		expect(new Set(names).size).toBe(names.length);
	});

	it("repeats each row a second time so the loop has no gap, and hides that copy from assistive technology", () => {
		const { container } = render(<Marquee />);
		const copies = container.querySelectorAll("[data-copy]");
		expect(copies).toHaveLength(4);
		for (const [index, copy] of [...copies].entries()) {
			if (index % 2 === 1) {
				expect(copy).toHaveAttribute("aria-hidden", "true");
				expect(copy.className).toContain("motion-reduce:hidden");
				for (const image of copy.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
			} else expect(copy).not.toHaveAttribute("aria-hidden");
		}
	});

	it("slides slowly to the left on the first row and to the right on the second, stops under the mouse, and holds still for anyone who asked for less motion", () => {
		const { container } = render(<Marquee />);
		const [first, second] = [...container.querySelectorAll("[data-track]")] as HTMLElement[];
		expect(first?.className).toContain("animate-marquee");
		expect(first?.className).not.toContain("animate-marquee-reverse");
		expect(second?.className).toContain("animate-marquee-reverse");
		for (const track of [first, second]) {
			expect(track?.className).toContain("motion-reduce:animate-none");
			expect(track?.className).toContain("hover:[animation-play-state:paused]");
			expect(track?.className).toContain("motion-reduce:flex-wrap");
			expect(track?.className).toContain("motion-reduce:justify-center");
		}
	});

	it("fades out toward both edges, and fills the width between the page margins", () => {
		const { container } = render(<Marquee />);
		const frames = container.querySelectorAll("[data-frame]");
		expect(frames).toHaveLength(2);
		for (const frame of frames) {
			expect(frame.className).toContain("overflow-hidden");
			expect(frame.className).toMatch(/mask-image:linear-gradient\(to_right,transparent/);
		}
		expect(section().className).toContain("px-(--gutter)");
		expect(section().className).toContain("bg-black");
	});

	it("shows each project's whole logo from its own file, with its size declared, and no name typed in our type", () => {
		const { container } = render(<Marquee />);
		const logos = [...container.querySelectorAll("[data-copy]:nth-of-type(1) [data-logo]")];
		const all = [...container.querySelectorAll("[data-logo]")].filter((image) =>
			image.getAttribute("alt"),
		);
		expect(all.map((image) => image.getAttribute("src"))).toEqual(
			[...STACK_RUNS_ON, ...STACK_WRITTEN_WITH].map((logo) => `/brand/stack/${logo.file}.svg`),
		);
		expect(logos.length).toBeGreaterThan(0);
		expect(container.querySelector("[data-word]")).toBeNull();
		for (const image of all) {
			expect(image).toHaveAttribute("height");
			expect(image).toHaveAttribute("width");
			expect(image).toHaveAttribute("decoding", "async");
			// Below the first screen, so they are fetched as the reader nears them.
			expect(image).toHaveAttribute("loading", "lazy");
		}
	});

	it("has every logo as a file that exists, and the companies' own colors in the ones that have them", () => {
		for (const logo of [...STACK_RUNS_ON, ...STACK_WRITTEN_WITH]) {
			expect(read(logo.file), logo.name).toContain("<svg");
			if (logo.gray) expect(read(logo.gray), logo.name).toContain("<svg");
		}
		expect(read("solana")).toContain("#9945FF");
		expect(read("solana")).toContain("#19FB9B");
		expect(read("jupiter")).toContain("#C7F284");
		expect(read("jupiter-gray")).not.toContain("#C7F284");
		expect(read("helius")).toContain("#E84125");
		expect(read("cloudflare")).toContain("#f48120");
		expect(read("cloudflare")).toContain(".st0{fill:#fff}");
		expect(read("postgresql").toLowerCase()).toContain("#336791");
	});

	it("shows them gray and dim until you look at them, then the whole logo in its own colors, by a filter and not by editing the file", () => {
		const { container } = render(<Marquee />);
		for (const item of container.querySelectorAll("[data-copy]:not([aria-hidden]) li")) {
			expect(item.className, nameOf(item) ?? "").toContain("group");
			const logo = item.querySelector("[data-logo]") as HTMLElement;
			const gray = item.querySelector("[data-rest]") as HTMLElement | null;
			if (gray) {
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

	it("uses Jupiter's own grayscale logo for its resting state, since Jupiter publishes one, and no other logo has a second file", () => {
		const { container } = render(<Marquee />);
		const rest = [...container.querySelectorAll("[data-copy]:not([aria-hidden]) [data-rest]")];
		expect(rest.map((image) => image.getAttribute("src"))).toEqual([
			"/brand/stack/jupiter-gray.svg",
		]);
	});

	it("is not a list of partners: no link, no claim, just what it is built with", () => {
		const { container } = render(<Marquee />);
		expect(container.querySelector("a")).toBeNull();
		expect(section().textContent ?? "").not.toMatch(
			/partner|trusted by|backed by|official|endorse/i,
		);
	});
});
