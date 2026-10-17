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
		expect(css).toMatch(/--silver-shine:\s*linear-gradient\(\s*105deg/);
		// Its stops are the cool gray of the headline silver, a hue of 260 and almost no chroma: nothing pink.
		const silver = /--silver-fill:([^;]*);/.exec(css)?.[1] ?? "";
		for (const stop of silver.match(/oklch\([^)]*\)/g) ?? []) expect(stop).toMatch(/ 260\)$/);
	});

	it("is silver at rest and brighter silver on hover, as a shine that slides across", () => {
		const base = rule(".silver-button {");
		expect(base).toContain("var(--silver-fill)");
		expect(base).toMatch(/background-size:\s*200% 100%/);
		expect(base).toMatch(/transition:\s*background-position 2\d\d ?ms/);
		const hover = rule(".silver-button:hover {");
		// One finish, and it is silver: light moving over metal, not a change of colour.
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

	it("shows the shine while it is pressed on a screen with no hover, so a phone sees it on a tap", () => {
		const block = /@media \(hover: none\)\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
		expect(block).toMatch(/\.silver-button:active/);
		const active = /\.silver-button:active[^{]*\{[^}]*\}/.exec(block)?.[0] ?? "";
		expect(active).toContain("var(--shimmer)");
	});

	it("has one finish, and no colour anywhere near a button", () => {
		// A pearl shimmer on hover was built and pulled (Ash, 2026-10-16). On a page that is black,
		// silver and pearl, colour on the one thing a person is about to click is what looks cheap.
		// Colour comes back later, deliberately, as blue in the backgrounds, not on the buttons.
		for (const gone of ["--pearl-shimmer", "--opal-shimmer", ".finish-silver", ".finish-opal"])
			expect(css, gone).not.toContain(gone);

		expect(css).toMatch(/\.silver-button\s*\{[^}]*--shimmer:\s*var\(--silver-shine\)/);

		// Every hover and press reads the one shimmer, and none of them names a gradient directly.
		const hovers = css.match(/\.silver-button(?:-mobile)?:(?:hover|active)[^{]*\{[^}]*\}/g) ?? [];
		const shown = hovers.filter(
			(block) => block.includes("--shimmer") || block.includes("--silver-fill"),
		);
		expect(shown.length).toBeGreaterThanOrEqual(3);
		for (const block of hovers) expect(block).not.toMatch(/var\(--(pearl|opal)-shimmer\)/);
	});
});
