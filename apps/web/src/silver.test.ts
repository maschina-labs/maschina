import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");
const rule = (selector: string) => {
	const start = css.indexOf(selector);
	return start < 0 ? "" : css.slice(start, css.indexOf("}", start) + 1);
};

describe("the silver button", () => {
	it("has one shared silver, the same metal as the headlines: a gradient from silver through near-white and back, never a flat color", () => {
		expect(css).toMatch(/--silver-fill:\s*linear-gradient\(\s*105deg/);
		expect(css).toMatch(/--pearl-shimmer:\s*linear-gradient\(\s*105deg/);
		// Its stops are the cool gray of the headline silver, a hue of 260 and almost no chroma: nothing pink.
		const silver = /--silver-fill:([^;]*);/.exec(css)?.[1] ?? "";
		for (const stop of silver.match(/oklch\([^)]*\)/g) ?? []) expect(stop).toMatch(/ 260\)$/);
	});

	it("is silver at rest and takes the pearl only on hover, as a shimmer that slides across", () => {
		const base = rule(".silver-button {");
		expect(base).toContain("var(--silver-fill)");
		expect(base).toMatch(/background-size:\s*200% 100%/);
		expect(base).toMatch(/transition:\s*background-position 2\d\d ?ms/);
		const hover = rule(".silver-button:hover {");
		// The finish on hover is whichever the button chose, which is pearl unless it says otherwise.
		expect(hover).toContain("var(--shimmer)");
		// It follows the pointer: the shimmer sits where the pointer is on the button, and falls back to the far end.
		expect(hover).toMatch(/background-position:\s*var\(--shine-x, 100%\) 0/);
	});

	it("holds still for anyone who asked for less motion, and has no hover to shimmer on a screen with no pointer", () => {
		expect(css).toMatch(
			/@media \(prefers-reduced-motion: reduce\)[^}]*\.silver-button[^}]*transition:\s*none/s,
		);
		expect(css).toMatch(/@media \(hover: none\)[^}]*\.silver-button:hover/s);
	});

	it("has a phone-only version for the Sign In box, which is plain text on a desktop", () => {
		expect(css).toMatch(/@media \(max-width: 1279px\)[^@]*\.silver-button-mobile/s);
	});

	it("shows the pearl while it is pressed on a screen with no hover, so a phone sees it on a tap", () => {
		const block = /@media \(hover: none\)\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
		expect(block).toMatch(/\.silver-button:active/);
		expect(block).toMatch(/\.silver-button-mobile:active/);
		const active = /\.silver-button:active[^{]*\{[^}]*\}/.exec(block)?.[0] ?? "";
		expect(active).toContain("var(--pearl-shimmer)");
	});

	it("has three finishes to choose from, each its own gradient: silver (white metal), pearl and opal, which are never mixed in one button", () => {
		for (const token of ["--silver-shine", "--pearl-shimmer", "--opal-shimmer"])
			expect(css).toMatch(new RegExp(`${token}:\\s*linear-gradient\\(\\s*105deg`));
		// The default is pearl; a button picks another by a class of its own, which only changes the one variable.
		expect(css).toMatch(/\.silver-button\s*\{[^}]*--shimmer:\s*var\(--pearl-shimmer\)/);
		expect(rule(".finish-silver {")).toContain("--shimmer: var(--silver-shine)");
		expect(rule(".finish-opal {")).toContain("--shimmer: var(--opal-shimmer)");
		// Silver and opal keep to the same cool silver at rest.
		expect(rule(".finish-opal {")).not.toContain("--silver-fill");
		// Every hover and press reads the chosen finish, and none of them names a finish directly.
		const hovers = css.match(/\.silver-button(?:-mobile)?:(?:hover|active)[^{]*\{[^}]*\}/g) ?? [];
		const shown = hovers.filter(
			(block) => block.includes("--shimmer") || block.includes("--silver-fill"),
		);
		expect(shown.length).toBeGreaterThanOrEqual(4);
		for (const block of hovers) expect(block).not.toMatch(/var\(--(pearl|opal)-shimmer\)/);
	});
});
