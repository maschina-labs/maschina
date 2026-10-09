import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "styles.css"), "utf8");

describe("the stylesheet", () => {
	// Tailwind only builds the classes it finds, and it never looks inside node_modules, where a workspace
	// package is linked. Without this the backgrounds lose their layout and draw as a strip at the top.
	it("reads the backgrounds package for its classes", () => {
		const source = css.match(/@source "([^"]*packages\/field\/src)"/)?.[1];
		expect(source).toBeDefined();
		expect(existsSync(resolve(here, source ?? ""))).toBe(true);
	});
});
