import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuiltWith } from "./built-with.tsx";

// What is claimed here has to be true, so each tool is pinned with the one thing it does for Maschina.
const TOOLS = [
	["Solana", "settlement", "https://solana.com"],
	["Turnkey", "signing", "https://www.turnkey.com"],
	["Helius", "RPC", "https://www.helius.dev"],
	["Jupiter", "swap routing", "https://jup.ag"],
	["Anthropic", "the manager AI", "https://www.anthropic.com"],
] as const;

describe("the built with strip", () => {
	it("says what Maschina is built with, and says plainly that these are not partnerships", () => {
		render(<BuiltWith />);
		const section = screen.getByRole("region", { name: "Built with" });
		expect(within(section).getByText("Built with")).toBeInTheDocument();
		expect(
			within(section).getByText("The tools Maschina is made with. These are not partnerships."),
		).toBeInTheDocument();
	});

	it("lists each tool once for assistive technology, as a link to its own site, with what it does", () => {
		render(<BuiltWith />);
		const list = screen.getByRole("list", { name: "Tools Maschina is built with" });
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(TOOLS.length);
		for (const [index, [name, does, href]] of TOOLS.entries()) {
			const item = items[index] as HTMLElement;
			expect(within(item).getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute(
				"href",
				href,
			);
			expect(item).toHaveTextContent(does);
		}
	});

	it("claims nothing else: no partner, customer or trusted-by wording anywhere", () => {
		const { container } = render(<BuiltWith />);
		const text = container.textContent ?? "";
		expect(text).not.toMatch(/trusted by|customers?|backed by|official/i);
		// "partnerships" appears once, and only to deny them.
		expect(text.match(/partner/gi)).toHaveLength(1);
		expect(text).toContain("not partnerships");
	});

	it("scrolls slowly as a marquee, pauses under the cursor, and stands still for reduced motion", () => {
		const { container } = render(<BuiltWith />);
		const track = container.querySelector("[data-track]") as HTMLElement;
		expect(track.className).toContain("animate-marquee");
		expect(track.className).toContain("motion-reduce:animate-none");
		expect(track.className).toContain("hover:[animation-play-state:paused]");
	});

	it("repeats the row for a seamless loop, with the copy hidden from assistive technology and the keyboard", () => {
		const { container } = render(<BuiltWith />);
		const copy = container.querySelector("[data-copy]") as HTMLElement;
		expect(copy).toHaveAttribute("aria-hidden", "true");
		expect(copy).toHaveAttribute("inert");
		// Reduced motion shows one row, so the copy goes.
		expect(copy.className).toContain("motion-reduce:hidden");
		expect(copy.querySelectorAll("a")).toHaveLength(TOOLS.length);
	});

	it("is dark, above the pinned hero so it rolls up over it, and square", () => {
		const { container } = render(<BuiltWith />);
		const { className } = screen.getByRole("region", { name: "Built with" });
		expect(className).toContain("bg-black");
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
		expect(className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});

	it("fades the row out at both ends, so names slide in and out softly", () => {
		const { container } = render(<BuiltWith />);
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.className).toContain(
			"[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
		);
	});
});
