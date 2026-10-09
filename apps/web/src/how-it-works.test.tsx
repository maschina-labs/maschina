import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HowItWorks } from "./how-it-works.tsx";

// Each line is a claim about the product, so each is pinned here: changing one means checking it is true.
const SENTENCES = [
	"An AI proposes the trade.",
	"The rules decide if it happens.",
	"Only the signer can sign it.",
	"Every trade settles where anyone can check.",
] as const;
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

const GRADIENT =
	"linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)";

const buttons = () => SENTENCES.map((name) => screen.getByRole("button", { name }));
const panels = () => [...document.querySelectorAll("[data-slide]")] as HTMLElement[];

describe("how it works", () => {
	it("opens with one large sentence made of four clickable sentences, one for each step", () => {
		render(<HowItWorks />);
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading.textContent).toBe(SENTENCES.join(" "));
		expect(heading.className).toMatch(/text-\[clamp\(1\.75rem,3vw,3rem\)\]/);
		// The sentences run on as a paragraph, not one to a line.
		for (const button of buttons()) expect(button.className).toContain("inline");
		for (const button of buttons()) expect(heading.contains(button)).toBe(true);
		expect(buttons().map((button) => button.textContent)).toEqual([...SENTENCES]);
	});

	it("fits on one screen: the section is a screen tall at most, and the slide is short enough to sit under the sentences", () => {
		render(<HowItWorks />);
		const { className } = screen.getByRole("region", { name: "How it works" });
		expect(className).toContain("min-h-dvh");
		expect(className).toContain("flex-col");
		expect(className).toContain("justify-center");
		expect(className).toContain("py-[clamp(4rem,10dvh,7rem)]");
		const poster = panels()[0]?.querySelector("[data-poster]") as HTMLElement;
		expect(poster.className).toContain("h-[min(34dvh,22rem)]");
		expect(poster.className).not.toContain("aspect-");
		expect(screen.getByRole("heading", { level: 2 }).nextElementSibling?.className).toContain(
			"mt-12",
		);
	});

	it("has a clear order of importance: the sentences, then what the step does, then its label and chips", () => {
		render(<HowItWorks />);
		const slide = panels()[0] as HTMLElement;
		const label = within(slide).getByRole("heading", { level: 3, hidden: true });
		const text = slide.querySelector("p") as HTMLElement;
		// The explanation is the big line of the slide; the title is only a small label above it.
		expect(text.className).toContain("text-[clamp(1.25rem,2vw,1.75rem)]");
		expect(text.className).toContain("leading-[1.4]");
		expect(label.className).toContain("text-[13px]");
		expect(label.className).toContain("uppercase");
		expect(label.className).toContain("text-neutral-400");
		expect(label.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// The poster holds only the colour and the number: the title is not repeated inside it.
		expect(slide.querySelector("[data-poster] h3")).toBeNull();
	});

	it("starts on the first step, with its sentence lit in the same silver and pearl gradient as the hero's headline", () => {
		render(<HowItWorks />);
		const [first, ...others] = buttons();
		expect(first).toHaveAttribute("aria-pressed", "true");
		// The gradient is a background image clipped to the letters, as in the hero. A `background` shorthand would
		// reset the clip and paint a solid block over the words.
		expect(first?.className).toContain(`bg-[${GRADIENT}]`);
		expect(first?.className).not.toContain("[background:");
		expect(first?.className).toContain("bg-clip-text");
		expect(first?.className).toContain("text-transparent");
		// Regular weight, the same as the hero: nothing here is bold.
		expect(first?.className).toContain("font-normal");
		expect(first?.className).not.toContain("font-medium");
		for (const button of others) {
			expect(button).toHaveAttribute("aria-pressed", "false");
			// The others are gray, and warm up a little under the cursor.
			expect(button.className).toContain("text-neutral-500");
			expect(button.className).toContain("hover:text-neutral-300");
			expect(button.className).toContain("font-normal");
			expect(button.className).not.toContain("bg-clip-text");
		}
	});

	it("brings you to another slide when you click a sentence, and lights that sentence instead", () => {
		render(<HowItWorks />);
		fireEvent.click(screen.getByRole("button", { name: SENTENCES[2] }));
		expect(screen.getByRole("button", { name: SENTENCES[2] })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: SENTENCES[2] }).className).toContain("bg-clip-text");
		expect(screen.getByRole("button", { name: SENTENCES[0] })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		expect(screen.getByRole("button", { name: SENTENCES[0] }).className).not.toContain(
			"bg-clip-text",
		);
		const shown = panels().filter((panel) => !panel.hasAttribute("inert"));
		expect(shown).toHaveLength(1);
		expect(within(shown[0] as HTMLElement).getByRole("heading", { level: 3 })).toHaveTextContent(
			"The signer signs.",
		);
	});

	it("has four slides, one for each sentence, each with its number, title, what it does and two chips", () => {
		render(<HowItWorks />);
		expect(panels()).toHaveLength(4);
		for (const [index, step] of STEPS.entries()) {
			const slide = panels()[index] as HTMLElement;
			expect(
				within(slide).getByRole("heading", { level: 3, hidden: true, name: step.title }),
			).toBeInTheDocument();
			expect(slide).toHaveTextContent(step.text);
			expect(slide).toHaveTextContent(`0${index + 1}`);
			const chips = [...slide.querySelectorAll("[data-chip]")].map((chip) => chip.textContent);
			expect(chips).toEqual([...step.chips]);
		}
	});

	it("shows only the slide you are on: the others are faded out, hidden from readers and out of the keyboard's way", () => {
		render(<HowItWorks />);
		const [first, ...rest] = panels();
		expect(first?.className).toContain("opacity-100");
		expect(first).not.toHaveAttribute("inert");
		expect(first).not.toHaveAttribute("aria-hidden");
		for (const slide of rest) {
			expect(slide.className).toContain("opacity-0");
			expect(slide.className).toContain("pointer-events-none");
			expect(slide).toHaveAttribute("inert");
			expect(slide).toHaveAttribute("aria-hidden", "true");
		}
		// They sit on top of each other and fade, so the section does not change height.
		for (const slide of panels()) {
			expect(slide.className).toContain("col-start-1");
			expect(slide.className).toContain("row-start-1");
			expect(slide.className).toContain("transition-opacity");
			expect(slide.className).toContain("motion-reduce:transition-none");
		}
	});

	it("ties each sentence to its slide, so assistive technology knows what it controls", () => {
		render(<HowItWorks />);
		for (const [index, button] of buttons().entries()) {
			const controls = button.getAttribute("aria-controls");
			expect(controls).toBeTruthy();
			expect(panels()[index]?.id).toBe(controls);
		}
	});

	it("gives each slide a bold flat color of its own: violet, silver, cyan and green, with a large outlined number", () => {
		render(<HowItWorks />);
		const posters = panels().map((slide) => slide.querySelector("[data-poster]") as HTMLElement);
		const surfaces = [
			"oklch(0.58_0.22_295)",
			"oklch(0.88_0.015_260)",
			"oklch(0.8_0.12_205)",
			"oklch(0.82_0.19_150)",
		];
		for (const [index, surface] of surfaces.entries()) {
			expect(posters[index]?.className).toContain(`bg-[${surface}]`);
			expect(posters[index]?.className).toContain(index === 0 ? "text-white" : "text-black");
			const number = posters[index]?.querySelector("[data-number]") as HTMLElement;
			expect(number).toHaveAttribute("aria-hidden", "true");
			expect(number).toHaveTextContent(String(index + 1));
			expect(number.className).toContain("text-transparent");
			expect(number.className).toContain("[-webkit-text-stroke:2px");
		}
	});

	it("has no arrows: the sentences are the controls", () => {
		render(<HowItWorks />);
		expect(screen.queryByRole("button", { name: /previous step|next step/i })).toBeNull();
	});

	describe("autoplay", () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());
		const pressed = () =>
			buttons().findIndex((button) => button.getAttribute("aria-pressed") === "true");
		const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

		it("moves on by itself every few seconds, round to the first again", () => {
			render(<HowItWorks />);
			expect(pressed()).toBe(0);
			wait(6500);
			expect(pressed()).toBe(1);
			wait(6500);
			expect(pressed()).toBe(2);
			wait(6500);
			expect(pressed()).toBe(3);
			wait(6500);
			expect(pressed()).toBe(0);
		});

		it("holds still while the cursor is over the section, and carries on when it leaves", () => {
			render(<HowItWorks />);
			const section = screen.getByRole("region", { name: "How it works" });
			fireEvent.mouseEnter(section);
			wait(30000);
			expect(pressed()).toBe(0);
			fireEvent.mouseLeave(section);
			wait(6500);
			expect(pressed()).toBe(1);
		});

		it("holds still while something inside it has the keyboard's focus", () => {
			render(<HowItWorks />);
			const section = screen.getByRole("region", { name: "How it works" });
			fireEvent.focus(buttons()[0] as HTMLElement);
			wait(30000);
			expect(pressed()).toBe(0);
			fireEvent.blur(buttons()[0] as HTMLElement);
			expect(section).toBeInTheDocument();
			wait(6500);
			expect(pressed()).toBe(1);
		});

		it("starts its count again after you choose a sentence, so the slide you chose is not whisked away", () => {
			render(<HowItWorks />);
			wait(5000);
			fireEvent.click(buttons()[2] as HTMLElement);
			wait(5000);
			expect(pressed()).toBe(2);
			wait(1600);
			expect(pressed()).toBe(3);
		});

		it("does not play for anyone who asked for less motion", () => {
			const original = window.matchMedia;
			window.matchMedia = ((query: string) => ({
				matches: query.includes("reduce"),
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
				addListener: () => {},
				removeListener: () => {},
				onchange: null,
				dispatchEvent: () => false,
			})) as typeof window.matchMedia;
			render(<HowItWorks />);
			wait(60000);
			window.matchMedia = original;
			expect(pressed()).toBe(0);
		});
	});

	it("keeps to the page margin, on black, square, and names no vendor and no partner", () => {
		const { container } = render(<HowItWorks />);
		const { className } = screen.getByRole("region", { name: "How it works" });
		expect(className).toContain("bg-black");
		expect(className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
