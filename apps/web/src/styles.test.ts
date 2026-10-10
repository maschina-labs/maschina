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

describe("pull down to refresh", () => {
	// The rule above would also switch off the browser's own pull down to refresh on a phone, which people rely on.
	// A touch screen has no trackpad bounce to guard against, so there the vertical pull is given back.
	it("is allowed on a touch screen, while the page still does not bounce with a mouse or trackpad", () => {
		expect(css).toMatch(
			/@media \(hover: none\) and \(pointer: coarse\)\s*\{\s*html,\s*body\s*\{[^}]*overscroll-behavior-y:\s*auto/,
		);
		// Sideways is still never chained, so a swipe on the preview cannot navigate back.
		expect(css).toMatch(/overscroll-behavior-x:\s*none/);
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
	// The page's scrollbar is the browser's own, for now: nothing here styles it.
	it("leaves the scrollbar to the browser", () => {
		expect(css).not.toMatch(/scrollbar/);
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
