import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Builders, SAMPLE } from "./builders.tsx";

// Each line is a claim about the SDK, taken from its own README and types, so each is pinned here.
const LEAD = "Build your own kind of machine.";
const REST =
	"It can only propose. Maschina holds the keys, checks the limits and writes the record.";
const POINTS = [
	[
		"A kind is data.",
		"The settings it accepts, and one function that looks at the state and proposes what to do.",
	],
	[
		"It can only propose.",
		"It never signs, never writes the record and never widens its own limits.",
	],
	[
		"Same rules for everyone.",
		"Your kind runs under the same budget, limits, wallet policy and permanent record as every built-in machine.",
	],
] as const;

describe("for builders", () => {
	it("opens with one large two-tone sentence, in regular weight like the hero: white first, then gray", () => {
		render(<Builders />);
		const heading = screen.getByRole("heading", { level: 2, name: `${LEAD} ${REST}` });
		const [lead, rest] = heading.querySelectorAll("span");
		expect(lead).toHaveTextContent(LEAD);
		expect(rest).toHaveTextContent(REST);
		expect(lead?.className).toContain("text-white");
		expect(rest?.className).toContain("text-neutral-500");
		expect(heading.className).toContain("font-normal");
		expect(heading.className).not.toMatch(/font-(medium|semibold|bold)/);
		expect(heading.className).toMatch(/text-\[clamp\(2rem,4vw,4rem\)\]/);
	});

	it("says three true things about a machine kind, in order", () => {
		render(<Builders />);
		const section = screen.getByRole("region", { name: "For builders" });
		const list = within(section).getByRole("list", { name: "What to know" });
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(3);
		for (const [index, [title, text]] of POINTS.entries()) {
			const item = items[index] as HTMLElement;
			expect(within(item).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
			expect(item).toHaveTextContent(text);
		}
	});

	it("shows real code, as text you can select, and says it is a preview of an SDK that is not published yet", () => {
		render(<Builders />);
		const code = screen.getByRole("figure", { name: "A machine kind written with the SDK" });
		const block = code.querySelector("pre code") as HTMLElement;
		// What is on screen is exactly the sample, nothing added or hidden.
		expect(block.textContent).toBe(SAMPLE);
		// And the sample uses the SDK's real surface: defineMachineKind, with a decide that acts or skips and says why.
		for (const part of [
			"defineMachineKind",
			'kind: "act"',
			'kind: "skip"',
			"reason:",
			"settings:",
			"decide(",
		]) {
			expect(SAMPLE).toContain(part);
		}
		expect(within(code).getByText("SDK preview. Not published yet.")).toBeInTheDocument();
		expect(within(code).getByText("TypeScript")).toBeInTheDocument();
		// No install line: there is nothing to install yet.
		expect(code.textContent).not.toMatch(/npm|pnpm add|yarn add|install/i);
	});

	it("colors the code lightly, in the page's own step colors, over a dark square panel", () => {
		render(<Builders />);
		const block = screen
			.getByRole("figure", { name: "A machine kind written with the SDK" })
			.querySelector("pre") as HTMLElement;
		expect(block.className).toContain("bg-[oklch(0.14_0.006_285)]");
		expect(block.className).toContain("font-mono");
		expect(block.className).toContain("overflow-x-auto");
		const colored = (token: string) =>
			[...block.querySelectorAll("span")].find((span) => span.textContent === token);
		expect(colored("import")?.className).toContain("oklch(0.8_0.11_300)");
		expect(colored('"dip-buyer"')?.className).toContain("oklch(0.82_0.17_150)");
		expect(colored("defineMachineKind")?.className).toContain("oklch(0.83_0.1_215)");
		expect(colored("// Buys when the price has dropped enough.")?.className).toContain(
			"text-neutral-500",
		);
	});

	it("has a link to the docs, as the gray box, and no claims about anything not built", () => {
		const { container } = render(<Builders />);
		const docs = screen.getByRole("link", { name: "Read the docs" });
		expect(docs).toHaveAttribute("href", "/docs");
		expect(docs.className).toMatch(/\bbg-white\/\[0\.13\]/);
		expect(container.textContent ?? "").not.toMatch(
			/mcp|skill file|marketplace|published on|available now/i,
		);
	});

	it("keeps to the page margin, on black, square, and names no vendor and no partner", () => {
		const { container } = render(<Builders />);
		const { className } = screen.getByRole("region", { name: "For builders" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});

	it("puts the points beside the code on a wide screen, and stacks them on a phone", () => {
		render(<Builders />);
		const grid = screen.getByRole("list", { name: "What to know" }).parentElement
			?.parentElement as HTMLElement;
		expect(grid.className).toContain("lg:grid-cols-[1fr_1.5fr]");
		expect(grid.className).toContain("grid");
	});
});
