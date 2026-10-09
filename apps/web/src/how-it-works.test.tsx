import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HowItWorks } from "./how-it-works.tsx";

// Each line is a claim about the product, so each is pinned here: changing one means checking it is true.
const LEAD = "An AI proposes the trade. Maschina decides if it happens.";
const REST = "Rules checked before anything is signed. Every trade settles where anyone can check.";
const STEPS = [
	{
		title: "The AI proposes.",
		text: "Your machine reads the market and proposes a trade. It holds no keys and cannot move money.",
		chips: ["Holds no keys", "Cannot move money"],
	},
	{
		title: "The rules decide.",
		text: "Budgets live in a ledger the machine cannot edit. Every limit is checked before anything is signed.",
		chips: ["Budget ledger", "Checked before signing"],
	},
	{
		title: "The signer signs.",
		text: "Only the signer can ask for a signature, and the wallet's policy only ever pays the owner.",
		chips: ["Signer only", "Pays the owner only"],
	},
	{
		title: "The record keeps it.",
		text: "Every trade settles on Solana, where anyone can check it.",
		chips: ["Settles on Solana", "Open to anyone"],
	},
] as const;

const strip = () => screen.getByRole("list", { name: "The four steps" });
const tiles = () => [...strip().children] as HTMLElement[];

describe("how it works", () => {
	it("opens with one large two-tone sentence that carries the whole message", () => {
		render(<HowItWorks />);
		const heading = screen.getByRole("heading", { level: 2, name: `${LEAD} ${REST}` });
		const [lead, rest] = heading.querySelectorAll("span");
		expect(lead).toHaveTextContent(LEAD);
		expect(rest).toHaveTextContent(REST);
		// White first, then the rest in gray, like the hero's line under its headline.
		expect(lead?.className).toContain("text-white");
		expect(rest?.className).toContain("text-neutral-500");
		expect(heading.className).toMatch(/text-\[clamp\(2rem,4vw,4rem\)\]/);
	});

	it("has no label above it: the sentence is the introduction", () => {
		render(<HowItWorks />);
		const section = screen.getByRole("region", { name: "How it works" });
		expect(within(section).queryByText(/^How it works$/)).toBeNull();
	});

	it("has four posters in a strip, in order, each with its number, its title, what it does and two chips", () => {
		render(<HowItWorks />);
		expect(tiles()).toHaveLength(4);
		for (const [index, step] of STEPS.entries()) {
			const tile = tiles()[index] as HTMLElement;
			expect(within(tile).getByRole("heading", { level: 3, name: step.title })).toBeInTheDocument();
			expect(tile).toHaveTextContent(step.text);
			expect(tile).toHaveTextContent(`0${index + 1}`);
			const chips = within(tile)
				.getAllByRole("listitem")
				.map((chip) => chip.textContent);
			expect(chips).toEqual([...step.chips]);
		}
	});

	it("gives each poster a bold flat color of its own, like a set of posters: violet, silver, cyan and green", () => {
		render(<HowItWorks />);
		const posters = tiles().map((tile) => tile.querySelector("[data-poster]") as HTMLElement);
		const surfaces = [
			"oklch(0.58_0.22_295)",
			"oklch(0.88_0.015_260)",
			"oklch(0.8_0.12_205)",
			"oklch(0.82_0.19_150)",
		];
		for (const [index, surface] of surfaces.entries()) {
			expect(posters[index]?.className).toContain(`bg-[${surface}]`);
		}
		// Words are white on the violet and black on the three light ones.
		expect(posters[0]?.className).toContain("text-white");
		for (const poster of posters.slice(1)) expect(poster.className).toContain("text-black");
		for (const poster of posters) expect(poster.className).toContain("aspect-[4/5]");
	});

	it("is a strip that slides sideways, snapping tile by tile, starting at the page margin, with the next one peeking in", () => {
		render(<HowItWorks />);
		expect(strip().className).toContain("flex");
		expect(strip().className).toContain("overflow-x-auto");
		expect(strip().className).toContain("snap-x");
		expect(strip().className).toContain("pl-(--gutter)");
		expect(strip().className).toContain("pr-(--gutter)");
		// No scrollbar on the strip itself: the arrows and the touch scroll are the controls.
		expect(strip().className).toContain("[scrollbar-width:none]");
		for (const tile of tiles()) {
			expect(tile.className).toContain("w-[min(78vw,28rem)]");
			expect(tile.className).toContain("shrink-0");
			expect(tile.className).toContain("snap-start");
		}
	});

	it("has arrows to move along it one poster at a time, off at either end", () => {
		render(<HowItWorks />);
		const previous = screen.getByRole("button", { name: "Previous step" });
		const next = screen.getByRole("button", { name: "Next step" });
		const list = strip();
		const scrollBy = vi.fn();
		const lastLeft = () => (scrollBy.mock.lastCall?.[0] as { left: number } | undefined)?.left ?? 0;
		list.scrollBy = scrollBy as unknown as typeof list.scrollBy;
		const measure = (scrollLeft: number) => {
			for (const [name, value] of Object.entries({
				scrollLeft,
				scrollWidth: 2000,
				clientWidth: 1000,
			})) {
				Object.defineProperty(list, name, { value, configurable: true });
			}
			fireEvent.scroll(list);
		};
		measure(0);
		expect(previous).toBeDisabled();
		expect(next).toBeEnabled();
		fireEvent.click(next);
		expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "smooth" }));
		expect(lastLeft()).toBeGreaterThan(0);
		measure(500);
		expect(previous).toBeEnabled();
		fireEvent.click(previous);
		expect(lastLeft()).toBeLessThan(0);
		measure(1000);
		expect(next).toBeDisabled();
		// Squares with a chevron, like the other buttons.
		expect(previous.className).not.toMatch(/rounded/);
		expect(previous.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
	});

	it("puts a large outlined number in each poster, as the footer's wordmark is outlined, hidden from readers", () => {
		render(<HowItWorks />);
		for (const [index, tile] of tiles().entries()) {
			const number = tile.querySelector("[data-number]") as HTMLElement;
			expect(number).toHaveAttribute("aria-hidden", "true");
			expect(number).toHaveTextContent(String(index + 1));
			expect(number.className).toContain("text-transparent");
			expect(number.className).toContain("[-webkit-text-stroke:2px");
		}
	});

	it("keeps to the page margin, on black, square, and names no vendor and no partner", () => {
		const { container } = render(<HowItWorks />);
		const { className } = screen.getByRole("region", { name: "How it works" });
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
		expect(screen.getByRole("heading", { level: 2 }).parentElement?.className).toContain(
			"px-(--gutter)",
		);
	});
});
