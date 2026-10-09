import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";

const NAMES = [
	"Solana",
	"Turnkey",
	"Helius",
	"Jupiter",
	"Anthropic",
	"DexScreener",
	"Cloudflare",
	"PostgreSQL",
	"Docker",
	"TypeScript",
	"React",
	"Vite",
	"Tailwind CSS",
	"Hono",
	"Drizzle",
	"Zod",
	"Node.js",
	"pnpm",
	"Turborepo",
	"Biome",
	"Vitest",
	"three.js",
];

describe("the marquee of what it is built with", () => {
	it("lists each tool by name, in plain text: no logos, no links, no colors, no heading", () => {
		const { container } = render(<Marquee />);
		const list = within(screen.getByRole("region", { name: "Built with" })).getByRole("list");
		const items = within(list).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual(NAMES);
		expect(container.querySelectorAll("img, svg, a, button, h1, h2, h3")).toHaveLength(0);
		for (const item of items) expect(item.className).toContain("text-neutral-500");
	});

	it("runs the same names twice, the second run hidden from assistive technology, so it can loop without a gap", () => {
		const { container } = render(<Marquee />);
		const lists = container.querySelectorAll("ul");
		expect(lists).toHaveLength(2);
		expect(lists[1]).toHaveAttribute("aria-hidden", "true");
		expect(lists[1]?.textContent).toBe(lists[0]?.textContent);
		const track = lists[0]?.parentElement as HTMLElement;
		expect(track.className).toContain("animate-marquee");
		expect(track.className).toContain("motion-reduce:animate-none");
		expect(track.className).toContain("w-max");
	});

	it("stays inside the page margins: the names are clipped at the same edges as every other section, and fade out there", () => {
		const { container } = render(<Marquee />);
		const section = screen.getByRole("region", { name: "Built with" });
		expect(section.className).toContain("bg-black");
		expect(section.className).toContain("px-(--gutter)");
		// The clip and the fade are on the inner window, not on the full width section, so nothing drifts into the margin.
		expect(section.className).not.toContain("overflow-hidden");
		expect(section.className).not.toContain("mask-image");
		const window = section.firstElementChild as HTMLElement;
		expect(window.className).toContain("overflow-hidden");
		expect(window.className).toContain("[mask-image:linear-gradient(to_right,transparent");
		expect(container.innerHTML).not.toMatch(/rounded|hover:/);
	});

	it("has the animation defined, slow, steady and looping", () => {
		const css = readFileSync(
			resolve(dirname(fileURLToPath(import.meta.url)), "styles.css"),
			"utf8",
		);
		expect(css).toMatch(/--animate-marquee:\s*marquee\s+\d+s\s+linear\s+infinite/);
		expect(css).toMatch(/@keyframes marquee[\s\S]*translate3d\(-50%/);
	});
});
