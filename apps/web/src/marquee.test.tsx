import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";

const NAMES = ["Solana", "Jupiter", "Raydium", "Turnkey", "Helius", "Cloudflare", "PostgreSQL"];
const section = () => screen.getByRole("region", { name: "Built With" });

describe("the marquee", () => {
	it("says what it is, Built with, and lists the tech Maschina really runs on, in order, once each for a reader", () => {
		render(<Marquee />);
		expect(within(section()).getByText("Built with")).toBeInTheDocument();
		const list = within(section()).getByRole("list");
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(NAMES);
	});

	it("repeats the names a second time so the loop has no gap, and hides that copy from assistive technology", () => {
		const { container } = render(<Marquee />);
		const copies = container.querySelectorAll("[data-copy]");
		expect(copies).toHaveLength(2);
		expect(copies[0]).not.toHaveAttribute("aria-hidden");
		expect(copies[1]).toHaveAttribute("aria-hidden", "true");
		expect([...(copies[1]?.querySelectorAll("li") ?? [])].map((item) => item.textContent)).toEqual(
			NAMES,
		);
	});

	it("slides slowly and steadily to the left, stops under the mouse, and does not move at all for anyone who asked for less motion", () => {
		const { container } = render(<Marquee />);
		const track = container.querySelector("[data-track]") as HTMLElement;
		expect(track.className).toContain("animate-marquee");
		expect(track.className).toContain("motion-reduce:animate-none");
		expect(track.className).toContain("hover:[animation-play-state:paused]");
		// With no motion the second copy would only repeat the first, so it goes.
		expect((container.querySelectorAll("[data-copy]")[1] as HTMLElement).className).toContain(
			"motion-reduce:hidden",
		);
		expect(track.className).toContain("motion-reduce:flex-wrap");
		expect(track.className).toContain("motion-reduce:justify-center");
	});

	it("fades out toward both edges, and fills the width between the page margins", () => {
		const { container } = render(<Marquee />);
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.className).toMatch(/mask-image:linear-gradient\(to_right,transparent/);
		expect(section().className).toContain("px-(--gutter)");
		expect(section().className).toContain("bg-black");
	});

	it("is names in type, not logos or links: nothing here borrows anyone's mark or implies a partnership", () => {
		const { container } = render(<Marquee />);
		expect(container.querySelector("img, svg, a")).toBeNull();
		expect(section().textContent ?? "").not.toMatch(
			/partner|trusted by|backed by|official|endorse/i,
		);
	});
});
