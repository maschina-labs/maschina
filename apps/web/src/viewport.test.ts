import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(here).filter(
	(name) => /\.(tsx?|css)$/.test(name) && !name.includes(".test."),
);

describe("the browser's bars only ever cover the page; they never resize it or move it", () => {
	// On a phone the address bar or the toolbar slides away as you scroll and comes back as you scroll up. Anything sized
	// in dvh follows it, so the page stretches and shifts under the reader's thumb. lvh is the height with the bars
	// gone: it never changes, so the page is always that tall and a bar that is showing simply sits on top of it.
	// svh is the height with the bars showing, which the difference between the two measures.
	it("sizes nothing in dvh or vh, which follow the bars", () => {
		const offenders = sources.filter((name) =>
			/\d(dvh|vh)\b|-dvh\b|-vh\b/.test(readFileSync(resolve(here, name), "utf8")),
		);
		expect(offenders).toEqual([]);
	});

	it("sizes the hero, the closing section, the footer and the page itself to the full height, lvh, so a bar can only overlap them", () => {
		const read = (name: string) => readFileSync(resolve(here, name), "utf8");
		expect(read("hero.tsx")).toContain("h-lvh");
		expect(read("closing.tsx")).toContain("min-h-[70lvh]");
		expect(read("footer.tsx")).toContain("min-h-lvh");
		expect(read("frame.tsx")).toContain("min-h-lvh");
		for (const name of ["hero.tsx", "closing.tsx", "footer.tsx", "frame.tsx"])
			expect(read(name)).not.toMatch(/h-svh|min-h-svh|70svh/);
	});

	it("keeps what sits at the foot of the hero clear of a bar that is showing: the gap between lvh and svh is the bar", () => {
		const read = (name: string) => readFileSync(resolve(here, name), "utf8");
		expect(read("hero.tsx")).toContain("bottom-[calc(2rem+100lvh-100svh)]");
		expect(read("hero.tsx")).toContain("pb-[calc(4rem+100lvh-100svh)]");
	});
});
