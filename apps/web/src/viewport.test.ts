import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(here).filter(
	(name) => /\.(tsx?|css)$/.test(name) && !name.includes(".test."),
);

describe("the page does not resize as the browser's bars come and go", () => {
	// On a phone the address bar slides away as you scroll down and back as you scroll up. A height in dvh follows it,
	// so anything sized that way, the hero above all, grows and shrinks under the reader's thumb and the whole page
	// shifts. svh is the height with the bars showing: it never changes while scrolling, so nothing moves.
	it("sizes nothing in dvh or vh, which follow the bars; only svh, which stays put", () => {
		const offenders = sources.filter((name) =>
			/\d(dvh|lvh|vh)\b|-dvh\b|-vh\b|-lvh\b/.test(readFileSync(resolve(here, name), "utf8")),
		);
		expect(offenders).toEqual([]);
	});

	it("does size the hero, the closing section, the footer and the page itself in svh", () => {
		const read = (name: string) => readFileSync(resolve(here, name), "utf8");
		expect(read("hero.tsx")).toContain("h-svh");
		expect(read("closing.tsx")).toContain("min-h-[70svh]");
		expect(read("footer.tsx")).toContain("min-h-svh");
		expect(read("site.tsx")).toContain("min-h-svh");
	});
});
