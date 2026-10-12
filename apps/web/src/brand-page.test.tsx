import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandPage } from "./brand-page.tsx";
import { BRAND } from "./company/brand.ts";

const AUTH = "https://auth.maschina.dev";
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

beforeEach(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("the brand assets page", () => {
	it("has the held mesh head with a button for the full asset pack, and a black sheet over it", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brand Assets");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		expect(head.nextElementSibling).toBe(container.querySelector("[data-sheet]"));
		const pack = within(head).getByRole("link", { name: /Full asset pack/ });
		expect(pack).toHaveAttribute("href", "/brand/maschina-brand-kit.zip");
		expect(pack).toHaveAttribute("download");
		// The words, then a black chip on the right with a white download icon in it, like the pearl buttons on the site.
		// The icon is hidden from assistive technology since the words say it.
		const chip = pack.lastElementChild as HTMLElement;
		expect(chip).toHaveAttribute("data-chip");
		expect(chip.className).toContain("bg-black");
		expect(chip.className).toContain("text-white");
		const icon = chip.querySelector("svg[data-icon=download]") as SVGElement;
		expect(icon).not.toBeNull();
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(pack.firstElementChild?.textContent).toBe("Full asset pack");
		expect(pack.className).toContain("silver-button");
		expect(document.title).toBe("Brand Assets | Maschina");
	});

	it("shows six logo tiles, three on dark and three on light, each with an SVG and a PNG to download", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const tiles = [...container.querySelectorAll("[data-logo]")];
		expect(tiles).toHaveLength(6);
		for (const tile of tiles) {
			const links = within(tile as HTMLElement).getAllByRole("link");
			expect(links.map((link) => link.textContent)).toEqual(["SVG", "PNG"]);
			for (const link of links) expect(link).toHaveAttribute("download");
		}
		expect(container.querySelectorAll("[data-logo][data-tone=dark]")).toHaveLength(3);
		expect(container.querySelectorAll("[data-logo][data-tone=light]")).toHaveLength(3);
	});

	it("joins each logo's dark and light halves into one card, so a logo is shown on both at once", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const cards = [...container.querySelectorAll("[data-specimen]")];
		expect(cards).toHaveLength(3);
		for (const card of cards) {
			const tones = [...card.querySelectorAll("[data-logo]")].map((tile) =>
				tile.getAttribute("data-tone"),
			);
			expect(tones).toEqual(["dark", "light"]);
		}
	});

	it("only offers files that exist, and a pack that exists", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const hrefs = [...container.querySelectorAll("a[download]")].map(
			(a) => a.getAttribute("href") ?? "",
		);
		expect(hrefs.length).toBe(13);
		for (const href of hrefs) expect(existsSync(resolve(PUBLIC, `.${href}`)), href).toBe(true);
	});

	it("gives each color its name, hex and oklch, as the site really uses them", () => {
		render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		for (const name of ["Black", "White", "Pearl", "Silver"])
			expect(screen.getByText(name, { selector: "[data-swatch] *" })).toBeInTheDocument();
		expect(screen.getByText("#EAE5F4")).toBeInTheDocument();
		expect(screen.getByText("oklch(0.93 0.02 300)")).toBeInTheDocument();
	});

	it("explains clearspace with a diagram for the wordmark and for the mark", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		expect(screen.getByRole("heading", { level: 2, name: "Clearspace" })).toBeInTheDocument();
		expect(container.querySelectorAll("[data-clearspace]")).toHaveLength(2);
		expect(screen.getByText("x = the height of the wordmark")).toBeInTheDocument();
		expect(screen.getByText("x = half the height of the mark")).toBeInTheDocument();
	});

	it("lays the colors out as one band, each one with its name, hex and oklch, that gives way to the one you point at", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const swatches = container.querySelectorAll("[data-swatch]");
		expect(swatches).toHaveLength(4);
		const band = container.querySelector("[data-spectrum]") as HTMLElement;
		expect(band.contains(swatches[0] as Element)).toBe(true);
		expect((swatches[0] as HTMLElement).className).toMatch(/hover:flex-/);
	});

	it("shows the typeface as a specimen: a big Aa in both weights and the alphabet and numbers, with no new words", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const specimen = container.querySelector("[data-specimen-type]") as HTMLElement;
		expect(specimen).not.toBeNull();
		expect(within(specimen).getAllByText("Aa")).toHaveLength(2);
		expect(specimen).toHaveTextContent("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
		expect(specimen).toHaveTextContent("0123456789");
	});

	it("shows each thing not to do as a picture of it done, with the rule as its caption", () => {
		const { container } = render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		const examples = [...container.querySelectorAll("[data-misuse]")];
		expect(examples).toHaveLength(BRAND.rules.dont.length);
		for (const [index, rule] of BRAND.rules.dont.entries()) {
			const example = examples[index] as HTMLElement;
			expect(example).toHaveTextContent(rule);
			// A cross on the picture, hidden from assistive technology, since the caption already says do not.
			expect(example.querySelector("[data-cross]")).toHaveAttribute("aria-hidden", "true");
			// The picture is decoration: the caption says what is wrong with it.
			for (const image of example.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
		}
	});

	it("says what not to do, names the typeface and says it is not in the kit", () => {
		render(<BrandPage authUrl={AUTH} doc={BRAND} />);
		expect(screen.getByRole("heading", { level: 2, name: "Using the logo" })).toBeInTheDocument();
		const all = JSON.stringify(BRAND);
		expect(all).toMatch(/Söhne/);
		expect(all).toMatch(/not included|not in the kit/i);
		expect(all).toMatch(/Do not stretch/i);
	});

	it("is written the way the site is: no long dashes, no placeholders, no shouting, no first person", () => {
		const all = JSON.stringify(BRAND);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|!/i);
		expect(all).not.toMatch(/\b(I|I'm|my|me)\b/);
	});
});
