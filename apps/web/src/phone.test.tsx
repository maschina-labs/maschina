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

	it("centers the gray buttons' labels too, and sets every button's words a little thicker and brighter so they read on a phone", () => {
		for (const element of [
			<Hero key="h" authUrl={AUTH} />,
			<Closing key="c" authUrl={AUTH} />,
			<Builders key="b" />,
			<HowItWorks key="w" authUrl={AUTH} />,
		]) {
			const { unmount } = render(element);
			const links = screen.getAllByRole("link");
			const gray = links.find((link) => link.className.includes("bg-white/[0.13]")) as HTMLElement;
			const pearl = links.find((link) =>
				link.className.includes("bg-[oklch(0.93_0.02_300)]"),
			) as HTMLElement;
			expect(gray.className).toContain("justify-center");
			expect(gray.className).toContain("max-sm:font-medium");
			expect(gray.className).toContain("max-sm:text-white");
			expect(pearl.className).toContain("max-sm:font-medium");
			unmount();
		}
	});
});

describe("the hero headline", () => {
	it("is two lines with the long one on top: the first is longer than the second, on every screen", () => {
		render(<Hero authUrl={AUTH} />);
		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading).toHaveAccessibleName("The operating system for autonomous capital.");
		const lines = [...heading.querySelectorAll("span")];
		expect(lines.map((line) => line.textContent)).toEqual([
			"The operating system for",
			"autonomous capital.",
		]);
		// Each is its own line, so the shape holds at every width instead of depending on how the browser balances it.
		for (const line of lines) expect(line.className).toContain("block");
		expect((lines[0]?.textContent ?? "").length).toBeGreaterThan(
			(lines[1]?.textContent ?? "").length,
		);
	});

	it("is sized so the long first line fits across a phone, and keeps its big size from a tablet up with no width cut", () => {
		render(<Hero authUrl={AUTH} />);
		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading.className).toContain("text-[clamp(1.6rem,8.4vw,2.5rem)]");
		expect(heading.className).toContain("sm:text-[clamp(2.5rem,6.4vw,7.5rem)]");
		expect(heading.className).toContain("max-w-none");
		// On a phone the headline may run a little into the page margin, so the long first line can be set bigger; from a tablet up it does not.
		expect(heading.className).toContain("max-sm:-mx-4");
		expect(heading.className).toContain("tracking-[-0.035em]");
		expect(heading.className).not.toContain("max-w-[18ch]");
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

	it("is fatter than on a desktop, with its two buttons at the small size", () => {
		const banner = header();
		const bar = banner.querySelector("[data-fade]")?.nextElementSibling
			?.nextElementSibling as HTMLElement;
		expect(bar.className).toContain("py-5");
		expect(bar.className).toContain("xl:py-4");
		const menu = screen.getByRole("button", { name: "Menu" });
		expect(menu.className).toContain("size-10");
		expect(menu.className).toContain("xl:hidden");
	});

	it("has one logo size everywhere, the desktop's own: 20px, so a phone's header and footer match each other and the desktop is exactly as it was", () => {
		const banner = header();
		const mark = banner.querySelector("[data-mark]") as HTMLElement;
		const word = banner.querySelector("[data-word] img") as HTMLElement;
		// Phone and desktop get the same size now. Before, a phone had 16px and from sm up 20px: the 20px is kept.
		expect(mark.className.split(" ")).toContain("size-5");
		expect(mark.className).not.toMatch(/sm:size-/);
		expect(word.className.split(" ")).toContain("h-5");
		expect(word.className).not.toMatch(/sm:h-/);
	});

	it("shows the same size logo in the footer as in the header", () => {
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const mark = footer.querySelector("[data-mark]") as HTMLElement;
		const word = footer.querySelector("[data-word] img") as HTMLElement;
		expect(mark.className.split(" ")).toContain("size-5");
		expect(mark.className).not.toMatch(/sm:size-/);
		expect(word.className.split(" ")).toContain("h-5");
		expect(word.className).not.toMatch(/sm:h-/);
	});

	it("draws the menu and close icons from Phosphor's own List and X (regular weight), not hand drawn lines", () => {
		const banner = header();
		const menu = within(banner).getByRole("button", { name: "Menu" });
		const paths = [...menu.querySelectorAll("svg")].map((svg) => ({
			view: svg.getAttribute("viewBox"),
			d: svg.querySelector("path")?.getAttribute("d"),
			fill: svg.getAttribute("fill"),
		}));
		expect(paths).toEqual([
			{
				view: "0 0 256 256",
				fill: "currentColor",
				d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z",
			},
			{
				view: "0 0 256 256",
				fill: "currentColor",
				d: "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z",
			},
		]);
	});

	it("has Log in as the pearl button on a phone, since it is the only call to action in the bar, right beside the menu button", () => {
		const banner = header();
		const logIn = within(banner).getByRole("link", { name: "Log in" });
		const menu = screen.getByRole("button", { name: "Menu" });
		// Pearl and black like the other main buttons, on a phone only: the desktop's plain text link is not touched.
		expect(logIn.className).toContain("max-xl:bg-[oklch(0.93_0.02_300)]");
		expect(logIn.className).toContain("max-xl:text-black");
		expect(logIn.className).toContain("max-xl:hover:bg-[oklch(0.98_0.015_300)]");
		expect(logIn.className).not.toMatch(/(^|\s)bg-white\/\[0\.13\]/);
		expect(logIn.className).toContain("h-10");
		expect(logIn.className).not.toMatch(/(^|\s)hidden(\s|$)/);
		expect(logIn.className).not.toMatch(/rounded/);
		// In the same row as the menu button, just before it (only the desktop's own Try button, hidden on a phone, may sit between).
		expect(logIn.parentElement).toBe(menu.parentElement);
		const row = [...(menu.parentElement?.children ?? [])];
		expect(row.indexOf(logIn)).toBeLessThan(row.indexOf(menu));
		const between = row.slice(row.indexOf(logIn) + 1, row.indexOf(menu));
		expect(between.every((each) => each.className.includes("hidden"))).toBe(true);
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
		// The backdrop starts at the page margin on the left and runs out to the edge of the screen on the right, so it is cut off there like the app is.
		expect(backdrop.className).toContain("max-sm:-mr-(--gutter)");
		// Its left edge is at the page margin, in line with everything else, not pushed over.
		expect(backdrop.className).not.toMatch(/max-sm:-?ml-/);
		expect(backdrop.className).not.toContain("max-sm:-mx-");
		expect(image.className).toContain("max-sm:max-w-none");
		expect(image.className).toContain("w-full");
	});
});

describe("the closing section on a phone", () => {
	it("puts its two buttons side by side and centered like on a desktop, not stacked full width", () => {
		render(<Closing authUrl={AUTH} />);
		const row = screen.getByRole("link", { name: "Start for free" }).parentElement as HTMLElement;
		expect(row.className).toContain("flex-row");
		expect(row.className).toContain("justify-center");
		expect(row.className).not.toContain("flex-col");
		expect(row.className).not.toContain("items-stretch");
		expect(row.className).toContain("sm:w-auto");
	});

	it("has the same outlined headline as every other section on a phone, so its weight matches", () => {
		render(<Closing authUrl={AUTH} />);
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading.className).toContain("max-sm:[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]");
	});

	it("glows harder on a phone: a bigger, brighter light along the footer and a bloom behind the headline", () => {
		const { container } = render(<Closing authUrl={AUTH} />);
		const glow = container.querySelector("[data-glow]") as HTMLElement;
		expect(glow.className).toContain("max-sm:h-[85%]");
		expect(glow.className).toMatch(
			/max-sm:bg-\[radial-gradient\([^\]]*oklch\(0\.92_0\.03_300\/0\.4/,
		);
		const bloom = container.querySelector("[data-bloom]") as HTMLElement;
		expect(bloom).toHaveAttribute("aria-hidden", "true");
		// Phones only: it is gone from a tablet up, so the desktop looks as it did.
		expect(bloom.className).toContain("sm:hidden");
		expect(bloom.className).toContain("pointer-events-none");
	});
});
