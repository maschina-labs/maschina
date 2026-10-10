import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "./faq.tsx";

// Short answers, each a claim about the product, so each is pinned here: changing one means checking it is true.
const QUESTIONS = [
	[
		"What is Maschina?",
		"A way to give an AI its own wallet and a job, like trading SOL. It works on its own, inside limits you set.",
	],
	[
		"What can a machine do with my money?",
		"Only what you allow: it spends inside the budget and limits you set, and Maschina never holds your own wallet's keys.",
	],
	[
		"What if it makes a bad trade?",
		"Every trade is checked against your budget and limits before it is signed, so it cannot spend more than you gave it.",
	],
	[
		"Do I need money to try it?",
		"No. Make a machine on paper and watch it trade against live prices without risking anything.",
	],
	[
		"Is it live with real money?",
		"Yes. Range Finder has traded real money on Solana since September 28, and every trade is on chain.",
	],
	[
		"Can I read the code?",
		"Yes. It is source-available: you can read it, but it is not open source.",
	],
] as const;

const triggers = () =>
	QUESTIONS.map(([question]) => screen.getByRole("button", { name: question }));
const answers = () => [...document.querySelectorAll("[data-answer]")] as HTMLElement[];

describe("the questions", () => {
	it("is a labelled section with a short heading", () => {
		render(<Faq />);
		const section = screen.getByRole("region", { name: "Questions" });
		expect(
			within(section).getByRole("heading", { level: 2, name: "Before you start." }),
		).toBeInTheDocument();
	});

	it("is centered: the title on top, the questions stacked in one column underneath it", () => {
		render(<Faq />);
		const section = screen.getByRole("region", { name: "Questions" });
		const heading = screen.getByRole("heading", { level: 2 });
		const list = screen.getByRole("list");
		expect(section.className).toContain("flex-col");
		expect(section.className).toContain("items-center");
		expect(heading.className).toContain("text-center");
		expect(heading.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// One column, centered, a comfortable reading width.
		expect(list.className).toContain("w-full");
		expect(list.className).toContain("max-w-3xl");
		expect(list.className).toContain("flex-col");
		expect(section.className).not.toMatch(/lg:grid-cols|lg:flex-row/);
	});

	it("has the title in the hero's pearl gradient with its thin outline, with room below for the letters' tails", () => {
		render(<Faq />);
		const { className } = screen.getByRole("heading", { level: 2 });
		expect(className).toContain("bg-clip-text");
		expect(className).toContain("text-transparent");
		expect(className).toContain(
			"linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)",
		);
		expect(className).toContain("[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]");
		expect(className).toContain("pb-[0.14em]");
		expect(className).toContain("-mb-[0.14em]");
	});

	it("does not light the whole row on hover: only the plus button lights, when you hover the question", () => {
		render(<Faq />);
		for (const trigger of triggers()) {
			// The row itself has no hover color of its own, shut or open...
			expect(trigger.className).not.toMatch(/(^|\s)hover:/);
			expect(trigger.closest("li")?.className).not.toMatch(/hover:/);
			// ...it only passes the hover on to the plus, which is what brightens.
			expect(trigger.className).toMatch(/(^|\s)group(\s|$)/);
			const mark = trigger.querySelector("[data-mark]") as HTMLElement;
			expect(mark.className).toContain("group-hover:bg-white/[0.18]");
			expect(mark.className).toContain("transition-colors");
			expect(mark.className).toContain("motion-reduce:transition-none");
		}
		fireEvent.click(triggers()[0] as HTMLElement);
		expect(triggers()[0]?.className).not.toMatch(/(^|\s)hover:/);
	});

	it("has six questions, in order, each a button that opens a short answer", () => {
		render(<Faq />);
		expect(triggers()).toHaveLength(QUESTIONS.length);
		for (const [index, [, answer]] of QUESTIONS.entries()) {
			expect(answers()[index]).toHaveTextContent(answer);
		}
		// Short: no answer runs past 130 characters.
		for (const [, answer] of QUESTIONS) expect(answer.length).toBeLessThanOrEqual(130);
	});

	it("starts with every answer shut, and opens one when you press its question", () => {
		render(<Faq />);
		for (const trigger of triggers()) expect(trigger).toHaveAttribute("aria-expanded", "false");
		for (const answer of answers()) {
			expect(answer).toHaveAttribute("inert");
			expect(answer).toHaveAttribute("aria-hidden", "true");
		}
		fireEvent.click(triggers()[1] as HTMLElement);
		expect(triggers()[1]).toHaveAttribute("aria-expanded", "true");
		expect(answers()[1]).not.toHaveAttribute("inert");
		expect(answers()[1]).not.toHaveAttribute("aria-hidden");
		expect(answers()[1]?.className).toContain("grid-rows-[1fr]");
	});

	it("keeps one open at a time: opening another closes the first, and pressing the open one shuts it", () => {
		render(<Faq />);
		fireEvent.click(triggers()[0] as HTMLElement);
		fireEvent.click(triggers()[3] as HTMLElement);
		expect(triggers()[0]).toHaveAttribute("aria-expanded", "false");
		expect(triggers()[3]).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(triggers()[3] as HTMLElement);
		expect(triggers()[3]).toHaveAttribute("aria-expanded", "false");
		expect(answers()[3]?.className).toContain("grid-rows-[0fr]");
	});

	it("slides each answer open and shut, and does not animate for anyone who asked for less motion", () => {
		render(<Faq />);
		for (const answer of answers()) {
			expect(answer.className).toContain("transition-[grid-template-rows]");
			expect(answer.className).toContain("motion-reduce:transition-none");
		}
	});

	it("ties each question to its answer, so assistive technology knows what it controls", () => {
		render(<Faq />);
		for (const [index, trigger] of triggers().entries()) {
			expect(answers()[index]?.id).toBe(trigger.getAttribute("aria-controls"));
		}
	});

	it("marks open and shut with a plus that turns to a minus, in a small square", () => {
		render(<Faq />);
		const mark = triggers()[0]?.querySelector("[data-mark]") as HTMLElement;
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(mark.className).toContain("size-9");
		expect(mark.className).not.toMatch(/rounded/);
		const upright = () => mark.querySelector("[data-upright]") as HTMLElement;
		expect(upright().className).toContain("scale-y-100");
		fireEvent.click(triggers()[0] as HTMLElement);
		expect(upright().className).toContain("scale-y-0");
	});

	it("keeps to the page margin, on black, square, and names no vendor and no partner", () => {
		const { container } = render(<Faq />);
		const { className } = screen.getByRole("region", { name: "Questions" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/rounded/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
