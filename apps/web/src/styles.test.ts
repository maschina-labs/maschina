import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "styles.css"), "utf8");

describe("the page margin", () => {
	// One margin for the whole site, so the header, every section and the footer line up on the same edges,
	// deep on a wide screen and still sensible on a phone.
	it("is one shared value that grows with the screen and stops at a limit", () => {
		expect(css).toMatch(/--gutter:\s*clamp\(/);
	});
});

describe("scrolling past the ends", () => {
	// Pulling the page past its top or bottom on a trackpad bounces it on a Mac, which shows the background
	// behind a sticky header and breaks the page's edges. It is switched off for the whole page.
	it("does not bounce, and does not chain to whatever is behind", () => {
		expect(css).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior:\s*none/);
	});
});

describe("the background package", () => {
	// Tailwind only builds the classes it finds, and it never looks inside node_modules, where a workspace
	// package is linked. Without this the ribbon loses its layout and draws as a strip at the top.
	it("is read for its classes", () => {
		const source = css.match(/@source "([^"]*packages\/field\/src)"/)?.[1];
		expect(source).toBeDefined();
		expect(existsSync(resolve(here, source ?? ""))).toBe(true);
	});
});

describe("motion", () => {
	it("defines the fade the ribbon arrives with, and stops it for reduced motion in the hero", () => {
		expect(css).toMatch(/--animate-fade-in:\s*fade-in/);
		expect(css).toMatch(/@keyframes fade-in/);
	});
});

describe("scrollbars", () => {
	// Every box on the site is square, and the scrollbar is one too: the track and the thumb, for the page and
	// for anything that scrolls inside it (such as the language list).
	const rule = (selector: string) =>
		css.match(new RegExp(`${selector.replace(/[()[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

	it("has a square track and a square thumb", () => {
		expect(rule("::-webkit-scrollbar-track")).toMatch(/border-radius:\s*0/);
		expect(rule("::-webkit-scrollbar-thumb")).toMatch(/border-radius:\s*0/);
		expect(css).toMatch(/\[data-scrolling\]::-webkit-scrollbar-thumb[^}]*border-radius:\s*0/);
		expect(css).toMatch(/\[data-scrolling\]::-webkit-scrollbar-track[^}]*border-radius:\s*0/);
	});

	it("is invisible until something scrolls, and shows only while it does", () => {
		// As on a Mac: no track and no thumb at rest, both there while scrolling.
		expect(rule("::-webkit-scrollbar-track")).toMatch(/background:\s*transparent/);
		expect(rule("::-webkit-scrollbar-thumb")).toMatch(/background:\s*transparent/);
		expect(css).toMatch(/\[data-scrolling\]::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*oklch/);
		expect(css).toMatch(/\[data-scrolling\]::-webkit-scrollbar-track\s*\{[^}]*background:\s*oklch/);
	});

	it("has a width, and a square corner where two scrollbars meet", () => {
		expect(rule("::-webkit-scrollbar")).toMatch(/width:\s*\d+px/);
		expect(rule("::-webkit-scrollbar-corner")).toMatch(/background:/);
	});

	it("keeps the standard scrollbar properties for browsers without the webkit ones", () => {
		// Where both are set, Chrome uses the standard ones and ignores the webkit rules above, which would
		// bring the rounded thumb back. So the standard ones only apply where the webkit ones do not exist.
		expect(css).toMatch(/@supports not selector\(::-webkit-scrollbar\)\s*\{[^}]*scrollbar-color:/);
		expect(css.replace(/@supports not selector[\s\S]*?\}\s*\}/, "")).not.toMatch(
			/scrollbar-color:/,
		);
	});
});

describe("smooth scrolling", () => {
	it("scrolls smoothly, except for anyone who asked for less motion", () => {
		expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
		expect(css).toMatch(
			/@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\s*\{[^}]*scroll-behavior:\s*auto/,
		);
	});
});

describe("the status blink", () => {
	it("defines a hard on and off blink, like a link light", () => {
		expect(css).toMatch(/--animate-blink:\s*blink/);
		expect(css).toMatch(/@keyframes blink/);
	});
});
