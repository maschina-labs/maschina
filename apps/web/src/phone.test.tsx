import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Builders } from "./builders.tsx";
import { Closing } from "./closing.tsx";
import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";
import { Customize, Features, HowItWorks } from "./sections.tsx";
import { Showcase } from "./showcase.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the main buttons on a phone", () => {
	it.each([
		["the hero", () => <Hero authUrl={AUTH} />],
		["the closing section", () => <Closing authUrl={AUTH} />],
		["for builders", () => <Builders />],
		["how it works", () => <HowItWorks authUrl={AUTH} />],
		["the app section", () => <Features authUrl={AUTH} />],
		["customize", () => <Customize authUrl={AUTH} />],
	])("has no chip, and a centered label, in %s", (_name, element) => {
		render(element());
		const pearl = screen
			.getAllByRole("link")
			.find((link) => link.className.includes("bg-[oklch(0.93_0.02_300)]")) as HTMLElement;
		// The chip is only for a screen wide enough to have room for it.
		expect(pearl.querySelector("[data-chip]")?.className).toContain("max-sm:hidden");
		// The label is centered on a phone and left on a wider screen, where the chip sits beside it.
		const label = pearl.firstElementChild as HTMLElement;
		expect(label.className).toContain("text-center");
		expect(label.className).toContain("sm:text-left");
		// Even padding on a phone, since nothing sits to the right of the words, and the chip's inset back from a tablet up.
		expect(pearl.className).toContain("px-5");
		expect(pearl.className).toContain("sm:pr-1");
		expect(pearl.className).not.toMatch(/(^|\s)pl-5/);
	});

	it("centers the gray buttons' labels too", () => {
		render(<Hero authUrl={AUTH} />);
		const docs = within(screen.getByRole("region", { name: "Maschina" })).getByRole("link", {
			name: "Read the docs",
		});
		expect(docs.className).toContain("justify-center");
	});
});

describe("the header on a phone", () => {
	const header = () => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
		);
		render(<Header authUrl={AUTH} />);
		return screen.getByRole("banner");
	};

	it("is fatter than on a desktop, with a bigger logo and a bigger menu button", () => {
		const banner = header();
		const bar = banner.querySelector("[data-fade]")?.nextElementSibling
			?.nextElementSibling as HTMLElement;
		expect(bar.className).toContain("py-5");
		expect(bar.className).toContain("xl:py-4");
		const mark = banner.querySelector("[data-mark]") as HTMLElement;
		expect(mark.className).toContain("size-6");
		expect(mark.className).toContain("sm:size-7");
		const word = banner.querySelector("[data-word] img") as HTMLElement;
		expect(word.className).toContain("h-6");
		expect(word.className).toContain("sm:h-7");
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu.className).toContain("size-12");
		expect(menu.className).toContain("xl:hidden");
	});

	it("leaves the footer's logo at its own size", () => {
		render(<Footer />);
		const mark = screen.getByRole("contentinfo").querySelector("[data-mark]") as HTMLElement;
		expect(mark.className).toContain("size-4");
		expect(mark.className).not.toContain("size-6");
	});
});

describe("the preview on a phone", () => {
	it("shows the app bigger than the screen, cropped at the right only, with its whole height and the whole backdrop showing", () => {
		render(<Showcase />);
		const image = screen.getByRole("img");
		const backdrop = image.closest("[data-backdrop]") as HTMLElement;
		// No padding at the right for it to end against, and nothing that cuts the height: the backdrop is as tall as the picture.
		expect(backdrop.className).toContain("max-sm:pr-0");
		expect(backdrop.className).not.toMatch(/max-sm:h-|max-sm:pb-0|max-h-/);
		expect(backdrop.className).toContain("overflow-hidden");
		// The picture is twice as wide as the room it has, so about half of it shows, the left half, and it keeps its own width from a tablet up.
		expect(image.className).toContain("max-sm:w-[200%]");
		expect(image.className).toContain("max-sm:max-w-none");
		expect(image.className).toContain("w-full");
	});
});
