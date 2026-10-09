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
