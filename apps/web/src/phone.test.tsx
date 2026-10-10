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

describe("the hero headline on a phone", () => {
	it("is sized to sit on two balanced lines instead of three, and keeps its big size from a tablet up", () => {
		render(<Hero authUrl={AUTH} />);
		const heading = screen.getByRole("heading", { level: 1 });
		// Smaller on a phone, so the whole sentence fits across two lines; the old size and width come back from sm.
		expect(heading.className).toContain("text-[clamp(1.7rem,8.4vw,2.5rem)]");
		expect(heading.className).toContain("sm:text-[clamp(2.5rem,6.4vw,7.5rem)]");
		expect(heading.className).toContain("max-w-none");
		expect(heading.className).toContain("sm:max-w-[18ch]");
		expect(heading.className).toContain("[text-wrap:balance]");
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

	it("is fatter than on a desktop, with a slightly bigger logo, and its two buttons are the small size", () => {
		const banner = header();
		const bar = banner.querySelector("[data-fade]")?.nextElementSibling
			?.nextElementSibling as HTMLElement;
		expect(bar.className).toContain("py-5");
		expect(bar.className).toContain("xl:py-4");
		const mark = banner.querySelector("[data-mark]") as HTMLElement;
		expect(mark.className).toContain("size-5");
		expect(mark.className).toContain("sm:size-6");
		const word = banner.querySelector("[data-word] img") as HTMLElement;
		expect(word.className).toContain("h-5");
		expect(word.className).toContain("sm:h-6");
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu.className).toContain("size-10");
		expect(menu.className).toContain("xl:hidden");
	});

	it("has Log in in a gray square box right beside the menu button, the same height as it", () => {
		const banner = header();
		const logIn = within(banner).getByRole("link", { name: "Log in" });
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(logIn.className).toContain("bg-white/[0.13]");
		expect(logIn.className).toContain("h-10");
		expect(logIn.className).not.toMatch(/(^|\s)hidden(\s|$)/);
		expect(logIn.parentElement).toBe(menu.parentElement);
		// Just before it in the same row (only the desktop's own Try button, hidden on a phone, may sit between).
		const row = [...(menu.parentElement?.children ?? [])];
		expect(row.indexOf(logIn)).toBeLessThan(row.indexOf(menu));
		const between = row.slice(row.indexOf(logIn) + 1, row.indexOf(menu));
		expect(between.every((each) => each.className.includes("hidden"))).toBe(true);
		expect(logIn.className).not.toMatch(/rounded/);
	});

	it("leaves the footer's logo at its own size", () => {
		render(<Footer />);
		const mark = screen.getByRole("contentinfo").querySelector("[data-mark]") as HTMLElement;
		const sizes = mark.className.split(" ");
		expect(sizes).toContain("size-4");
		expect(sizes).not.toContain("size-5");
	});
});

describe("the preview on a phone", () => {
	it("shows the app big, cropped at the right, with its whole height, and swipes sideways to show the rest", () => {
		render(<Showcase />);
		const image = screen.getByRole("img");
		const backdrop = image.closest("[data-backdrop]") as HTMLElement;
		// Nothing cuts the height: the backdrop is as tall as the picture. The reader swipes it sideways to see the rest.
		expect(backdrop.className).toContain("max-sm:overflow-x-auto");
		expect(backdrop.className).toContain("max-sm:[scrollbar-width:none]");
		expect(backdrop.className).not.toMatch(/max-sm:h-|max-sm:pb-0|max-h-/);
		expect(backdrop.className).toContain("overflow-hidden");
		// The picture is two and eight tenths times as wide as the room it has, so it is big enough to read, and it keeps its own width from a tablet up.
		expect(image.className).toContain("max-sm:w-[320%]");
		expect(image.className).not.toContain("max-sm:-ml-");
		// The backdrop starts under the left edge of the title and runs out to the edge of the screen on the right, so it is cut off there like the app is.
		expect(backdrop.className).toContain("max-sm:-mr-(--gutter)");
		// Its top left corner lines up with the left edge of the title above it ("in one place." is about 11.6rem wide and centered).
		expect(backdrop.className).toContain("max-sm:ml-[calc((100%-11.6rem)/2)]");
		expect(backdrop.className).not.toContain("max-sm:-mx-");
		expect(image.className).toContain("max-sm:max-w-none");
		expect(image.className).toContain("w-full");
	});
});
