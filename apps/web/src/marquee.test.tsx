import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";

const here = dirname(fileURLToPath(import.meta.url));

const NAMES = [
	"Solana",
	"Turnkey",
	"Helius",
	"Jupiter",
	"Anthropic",
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
	"DexScreener",
];
// The four whose own files already hold the name, so they are shown as the logo alone.
const LOCKUPS = ["Solana", "Turnkey", "Helius", "Jupiter"];

describe("the marquee of what it is built with", () => {
	it("says in words that these are what it is built with, so it reads as a list of tools and not as partners", () => {
		render(<Marquee />);
		const section = screen.getByRole("region", { name: "Built with" });
		const label = within(section).getByText("Built with");
		expect(label.tagName).toBe("P");
		expect(label.className).toContain("text-center");
		expect(label.className).toContain("text-neutral-500");
		expect(section.textContent ?? "").not.toMatch(
			/partner|trusted|backed|sponsor|powered by|integrat/i,
		);
	});

	it("shows each tool's own logo: the four with a lockup as the logo alone, the others as their mark with the name beside it", () => {
		const { container } = render(<Marquee />);
		const list = within(screen.getByRole("region", { name: "Built with" })).getByRole("list");
		const items = within(list).getAllByRole("listitem");
		expect(items.map((item) => item.textContent?.trim())).toEqual(NAMES);
		for (const [index, name] of NAMES.entries()) {
			const item = items[index] as HTMLElement;
			if (LOCKUPS.includes(name)) {
				// The logo file itself, with the name only for readers who cannot see it.
				const logo = item.querySelector("img, [data-logo]") as HTMLElement;
				expect(logo, name).not.toBeNull();
				expect(item.querySelector(".sr-only")?.textContent).toBe(name);
			} else if (name === "DexScreener") {
				// It has no file of its own to use, so its name is set in type.
				expect(item.querySelector("img, [data-logo]")).toBeNull();
			} else {
				expect(item.querySelector("[data-logo]"), name).not.toBeNull();
				expect(item.querySelector("[data-logo]")).toHaveAttribute("aria-hidden", "true");
			}
		}
		expect(container.querySelectorAll("a, button")).toHaveLength(0);
	});

	it("has every logo file in the site, gray at rest, in nothing but the quiet gray of the page", () => {
		const { container } = render(<Marquee />);
		const used = new Set<string>();
		for (const node of container.querySelectorAll("img, [data-logo]")) {
			const source =
				node.getAttribute("src") ??
				(node.getAttribute("style") ?? "").match(/url\(([^)]+)\)/)?.[1] ??
				"";
			expect(source, "a logo with a file").toMatch(/^\/brand\/built-with\/[a-z.]+\.svg$/);
			used.add(source);
		}
		expect(used.size).toBe(21);
		for (const source of used)
			expect(existsSync(resolve(here, "../public", source.slice(1)))).toBe(true);
		for (const image of container.querySelectorAll("img"))
			expect(image.className).toContain("grayscale(1)");
		for (const mark of container.querySelectorAll("[data-logo]"))
			expect(mark.className).toContain("bg-neutral-500");
	});

	it("runs the same row twice, the second hidden from assistive technology, so it loops with no gap", () => {
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

	it("stays inside the page margins: clipped at the same edges as every other section, and fades out there", () => {
		const { container } = render(<Marquee />);
		const section = screen.getByRole("region", { name: "Built with" });
		expect(section.className).toContain("bg-black");
		expect(section.className).toContain("px-(--gutter)");
		expect(section.className).not.toContain("overflow-hidden");
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.className).toContain("[mask-image:linear-gradient(to_right,transparent");
		expect(container.innerHTML).not.toMatch(/rounded|hover:/);
	});

	it("has the animation defined, slow, steady and looping", () => {
		const css = readFileSync(resolve(here, "styles.css"), "utf8");
		expect(css).toMatch(/--animate-marquee:\s*marquee\s+\d+s\s+linear\s+infinite/);
		expect(css).toMatch(/@keyframes marquee[\s\S]*translate3d\(-50%/);
	});
});
