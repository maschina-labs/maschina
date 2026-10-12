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
		expect(hover).toContain("var(--pearl-shimmer)");
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
});
