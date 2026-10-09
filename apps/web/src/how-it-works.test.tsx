import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HowItWorks } from "./how-it-works.tsx";

// Each line is a claim about the product, so each is pinned here: changing one means checking it is true.
const STEPS = [
	["AI proposes", "It reads the market and suggests a trade."],
	["Rules check", "Your budget and limits, before anything is signed."],
	["Signer signs", "Only the signer can sign, and only to pay you."],
	["Anyone can verify", "Every trade settles on Solana."],
] as const;
const FACTS = [
	["Buy SOL with USDC", "Proposed by the AI"],
	["Within the budget", "Within the limits"],
	["Signed by the signer", "Pays the owner only"],
	["Settled on Solana", "Open to anyone"],
] as const;
const STATUS = ["Proposed", "Checked", "Signed", "Settled"] as const;

const steps = () =>
	within(screen.getByRole("list", { name: "The four steps" })).getAllByRole("listitem");
const current = () => steps().findIndex((step) => step.getAttribute("aria-current") === "step");
const facts = () => [...document.querySelectorAll("[data-fact]")] as HTMLElement[];
const shown = () => facts().filter((fact) => fact.className.includes("opacity-100"));

/** Scrolls the page so the section is `progress` of the way through its pinned stretch (0 to 1). */
const scrollTo = (progress: number, height = 3000, viewport = 1000) => {
	Object.defineProperty(window, "innerHeight", { value: viewport, configurable: true });
	const section = screen.getByRole("region", { name: "How it works" });
	section.getBoundingClientRect = () =>
		({ top: -progress * (height - viewport), height }) as DOMRect;
	act(() => void fireEvent.scroll(window));
};

describe("how it works, as a story that follows one trade down the page", () => {
	afterEach(() => vi.restoreAllMocks());

	it("is a tall section whose screen stays pinned while the page scrolls past, with the pearl title on top", () => {
		render(<HowItWorks />);
		const section = screen.getByRole("region", { name: "How it works" });
		expect(section.className).toContain("h-[360dvh]");
		expect(section.className).toContain("bg-black");
		const pin = section.querySelector("[data-pin]") as HTMLElement;
		expect(pin.className).toContain("sticky");
		expect(pin.className).toContain("top-0");
		expect(pin.className).toContain("h-dvh");
		const heading = within(pin).getByRole("heading", { level: 2, name: "How it works." });
		expect(heading.className).toContain("text-center");
		expect(heading.className).toContain("bg-clip-text");
		expect(heading.className).toContain("text-transparent");
		expect(heading.className).toContain("[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]");
		expect(heading.className).toContain("pb-[0.14em]");
		expect(heading.className).toContain("-mb-[0.14em]");
	});

	it("lists the four steps in order and starts on the first, which is marked as the current step", () => {
		render(<HowItWorks />);
		expect(steps()).toHaveLength(4);
		for (const [index, [title]] of STEPS.entries()) {
			expect(
				within(steps()[index] as HTMLElement).getByRole("heading", { level: 3, name: title }),
			).toBeInTheDocument();
			expect(steps()[index]).toHaveTextContent(`0${index + 1}`);
		}
		expect(current()).toBe(0);
	});

	it("moves on a step as the page scrolls, by native scrolling: a quarter of the way through for each step", () => {
		render(<HowItWorks />);
		scrollTo(0);
		expect(current()).toBe(0);
		scrollTo(0.26);
		expect(current()).toBe(1);
		scrollTo(0.51);
		expect(current()).toBe(2);
		scrollTo(0.76);
		expect(current()).toBe(3);
		scrollTo(1);
		expect(current()).toBe(3);
		// And back up again, so scrolling back un-tells the story.
		scrollTo(0.3);
		expect(current()).toBe(1);
		scrollTo(0);
		expect(current()).toBe(0);
	});

	it("does not take over the scroll: no wheel or touch listeners, only a passive scroll one", () => {
		const add = vi.spyOn(window, "addEventListener");
		render(<HowItWorks />);
		const types = add.mock.calls.map(([type]) => type);
		expect(types).not.toContain("wheel");
		expect(types).not.toContain("touchmove");
		expect(types).not.toContain("keydown");
		const scroll = add.mock.calls.find(([type]) => type === "scroll");
		expect(scroll?.[2]).toEqual({ passive: true });
	});

	it("shows the one-line explanation for the current step only, and the others are folded away and out of the way", () => {
		render(<HowItWorks />);
		scrollTo(0.51);
		for (const [index, [, line]] of STEPS.entries()) {
			const step = steps()[index] as HTMLElement;
			const explanation = step.querySelector("[data-line]") as HTMLElement;
			expect(explanation).toHaveTextContent(line);
			if (index === 2) {
				expect(explanation.className).toContain("grid-rows-[1fr]");
				expect(explanation).not.toHaveAttribute("inert");
			} else {
				expect(explanation.className).toContain("grid-rows-[0fr]");
				expect(explanation).toHaveAttribute("inert");
				expect(explanation).toHaveAttribute("aria-hidden", "true");
			}
		}
	});

	it("lights the current step in the pearl gradient, keeps the steps already passed a soft gray, and dims the ones to come", () => {
		render(<HowItWorks />);
		scrollTo(0.51);
		const title = (index: number) => steps()[index]?.querySelector("h3") as HTMLElement;
		expect(title(2).className).toContain("bg-clip-text");
		expect(title(2).className).toContain("text-transparent");
		expect(title(2).className).toContain("linear-gradient(105deg");
		for (const passed of [0, 1]) expect(title(passed).className).toContain("text-neutral-400");
		expect(title(3).className).toContain("text-neutral-700");
		for (const index of [0, 1, 2, 3]) {
			expect(title(index).className).toContain("font-normal");
			expect(title(index).className).toContain("transition-colors");
		}
	});

	it("gives each step its own small colored square, the page's step colors", () => {
		render(<HowItWorks />);
		const colors = [
			"oklch(0.8_0.11_300)",
			"oklch(0.82_0.06_250)",
			"oklch(0.83_0.1_215)",
			"oklch(0.82_0.17_150)",
		];
		for (const [index, color] of colors.entries()) {
			const marker = steps()[index]?.querySelector("[data-marker]") as HTMLElement;
			expect(marker).toHaveAttribute("aria-hidden", "true");
			expect(marker.className).toContain(`bg-[${color}]`);
		}
	});

	it("builds a trade card as you scroll: its status changes, and two more facts appear with each step", () => {
		render(<HowItWorks />);
		const card = document.querySelector("[data-card]") as HTMLElement;
		const status = card.querySelector("[data-status]") as HTMLElement;
		expect(facts()).toHaveLength(8);
		for (const [index, label] of STATUS.entries()) {
			scrollTo(index / 4 + 0.01);
			expect(status).toHaveTextContent(label);
			expect(shown()).toHaveLength((index + 1) * 2);
		}
		// What each step reveals is exactly what the product does at that step.
		scrollTo(0.01);
		expect(shown().map((fact) => fact.textContent)).toEqual([...FACTS[0]]);
		scrollTo(0.76);
		expect(shown().map((fact) => fact.textContent)).toEqual(FACTS.flat());
	});

	it("says plainly that the card is an example, and hides it from readers, since the list already says all of it", () => {
		render(<HowItWorks />);
		const card = document.querySelector("[data-card]") as HTMLElement;
		expect(card).toHaveAttribute("aria-hidden", "true");
		expect(within(card).getByText("Example")).toBeInTheDocument();
		// No numbers, no prices, no results: nothing that could pass for a real trade.
		expect(card.textContent ?? "").not.toMatch(/\d|\$|%|profit|gain/i);
	});

	it("fades each fact in, and does not animate for anyone who asked for less motion", () => {
		render(<HowItWorks />);
		for (const fact of facts()) {
			expect(fact.className).toContain("transition-opacity");
			expect(fact.className).toContain("motion-reduce:transition-none");
		}
	});

	describe("for anyone who asked for less motion", () => {
		const reduce = () => {
			vi.spyOn(window, "matchMedia").mockImplementation(
				(query: string) =>
					({
						matches: query.includes("reduce"),
						media: query,
						addEventListener: () => {},
						removeEventListener: () => {},
						addListener: () => {},
						removeListener: () => {},
						onchange: null,
						dispatchEvent: () => false,
					}) as MediaQueryList,
			);
		};

		it("is not pinned and not tall: just the whole story at once, every step open and every fact shown", () => {
			reduce();
			render(<HowItWorks />);
			const section = screen.getByRole("region", { name: "How it works" });
			expect(section.className).not.toContain("h-[360dvh]");
			expect(section.querySelector("[data-pin]")?.className).not.toContain("sticky");
			expect(current()).toBe(-1);
			expect(shown()).toHaveLength(8);
			for (const step of steps()) {
				expect(step.querySelector("[data-line]")?.className).toContain("grid-rows-[1fr]");
			}
		});
	});

	it("keeps to the page margin, square, and names no vendor and no partner", () => {
		const { container } = render(<HowItWorks />);
		const pin = container.querySelector("[data-pin]") as HTMLElement;
		expect(pin.className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
