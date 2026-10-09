import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Explain } from "./explain.tsx";

// Each line is a claim about the product, so each is pinned here: changing one means checking it is true.
const ROWS = [
	[
		"What it is",
		"Maschina lets you give an AI its own wallet and a job, like trading SOL, and it works on its own, around the clock.",
	],
	[
		"What it does",
		"Each machine reads the market, decides, and trades inside limits you set. It never holds your keys, and it can only ever pay you.",
	],
	[
		"Why you can trust it",
		"The AI only proposes. Rules check every trade before it is signed, and every trade settles on Solana, where anyone can check it.",
	],
	["How to start", "Start on paper, with no money. Move to real money when you trust it."],
] as const;

const rows = () =>
	within(screen.getByRole("list", { name: "What Maschina is" })).getAllByRole("listitem");

describe("the explanation", () => {
	it("says what Maschina is in four short rows, in the order a newcomer asks: what, how, why, and how to start", () => {
		render(<Explain />);
		expect(rows()).toHaveLength(4);
		for (const [index, [label, sentence]] of ROWS.entries()) {
			const row = rows()[index] as HTMLElement;
			expect(within(row).getByRole("heading", { level: 3, name: label })).toBeInTheDocument();
			expect(within(row).getByText(sentence)).toBeInTheDocument();
		}
	});

	it("puts the plain sentence first in size and weight: large and white, with the label a small gray line beside it", () => {
		render(<Explain />);
		for (const row of rows()) {
			const label = within(row).getByRole("heading", { level: 3 });
			const sentence = row.querySelector("p") as HTMLElement;
			expect(sentence.className).toContain("text-[clamp(1.5rem,2.6vw,2.5rem)]");
			expect(sentence.className).toContain("text-white");
			expect(sentence.className).toContain("font-normal");
			expect(sentence.className).toContain("leading-[1.2]");
			expect(label.className).toContain("text-[13px]");
			expect(label.className).toContain("text-neutral-500");
			expect(label.className).toContain("uppercase");
		}
	});

	it("lines each label up with the first line of its sentence, not the middle of it", () => {
		render(<Explain />);
		for (const row of rows()) {
			const label = within(row).getByRole("heading", { level: 3 }).parentElement as HTMLElement;
			expect(label.className).toContain("self-start");
		}
	});

	it("gives each label its own small colored square, the page's own step colors, so the four read as a sequence", () => {
		render(<Explain />);
		const colors = [
			"oklch(0.8_0.11_300)",
			"oklch(0.82_0.06_250)",
			"oklch(0.83_0.1_215)",
			"oklch(0.82_0.17_150)",
		];
		for (const [index, color] of colors.entries()) {
			const marker = rows()[index]?.querySelector("[data-marker]") as HTMLElement;
			expect(marker).toHaveAttribute("aria-hidden", "true");
			expect(marker.className).toContain(`bg-[${color}]`);
			expect(marker.className).toContain("size-2.5");
		}
	});

	it("is laid out for a quick read: label on the left and sentence on the right on a wide screen, stacked on a phone, with room between rows", () => {
		render(<Explain />);
		const list = screen.getByRole("list", { name: "What Maschina is" });
		expect(list.className).toContain("flex-col");
		expect(list.className).toContain("gap-12");
		for (const row of rows()) {
			expect(row.className).toContain("lg:grid-cols-[minmax(0,16rem)_1fr]");
			expect(row.className).toContain("grid");
		}
	});

	it("is a still section: no animation, no interaction, nothing to click", () => {
		const { container } = render(<Explain />);
		expect(container.querySelector("button, a, input")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-|transition-|hover:/);
	});

	it("keeps to the page margin, on black, square, and names no vendor and no partner", () => {
		const { container } = render(<Explain />);
		const { className } = screen.getByRole("region", { name: "What Maschina is" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
