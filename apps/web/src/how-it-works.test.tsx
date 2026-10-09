import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./how-it-works.tsx";

// Each line is a claim about the product, so each is pinned here: changing one means checking it is true.
const STEPS = [
	[
		"The AI proposes.",
		"Your machine reads the market and proposes a trade. It holds no keys and cannot move money.",
	],
	[
		"The rules decide.",
		"Budgets live in a ledger the machine cannot edit. Every limit is checked before anything is signed.",
	],
	[
		"The signer signs.",
		"Only the signer can ask for a signature, and the wallet's policy only ever pays the owner.",
	],
	["The record keeps it.", "Every trade settles on Solana, where anyone can check it."],
] as const;

const steps = () =>
	within(screen.getByRole("list", { name: "The four steps" })).getAllByRole("listitem");

describe("how it works", () => {
	it("is a labelled section with a heading and a one line promise", () => {
		render(<HowItWorks />);
		const section = screen.getByRole("region", { name: "How it works" });
		expect(
			within(section).getByRole("heading", {
				level: 2,
				name: "From idea to settled, in four steps.",
			}),
		).toBeInTheDocument();
		expect(within(section).getByText("The AI never holds the keys.")).toBeInTheDocument();
	});

	it("has four steps, in order, each with its number, its title and what it does", () => {
		render(<HowItWorks />);
		expect(steps()).toHaveLength(4);
		for (const [index, [title, text]] of STEPS.entries()) {
			const step = steps()[index] as HTMLElement;
			expect(within(step).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
			expect(step).toHaveTextContent(text);
			expect(step).toHaveTextContent(`0${index + 1}`);
		}
	});

	it("gives each step its own color, so the four read as one chain: violet, silver blue, cyan, green", () => {
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

	it("lays the steps out in a grid that stacks on a phone, in square boxes", () => {
		const { container } = render(<HowItWorks />);
		const list = screen.getByRole("list", { name: "The four steps" });
		expect(list.className).toContain("grid");
		expect(list.className).toContain("sm:grid-cols-2");
		expect(list.className).toContain("lg:grid-cols-4");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});

	it("keeps to the page margin, on black, and names no vendor and no partner", () => {
		const { container } = render(<HowItWorks />);
		const { className } = screen.getByRole("region", { name: "How it works" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
