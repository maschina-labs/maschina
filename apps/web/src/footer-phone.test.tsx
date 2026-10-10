import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";

// Where a screen has no mouse, nothing can hover over the wordmark to light it, so it lights itself.
function screenWith(options: { noHover: boolean; reducedMotion?: boolean }) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: query.includes("hover: none")
				? options.noHover
				: query.includes("prefers-reduced-motion")
					? Boolean(options.reducedMotion)
					: false,
			addEventListener() {},
			removeEventListener() {},
		})),
	);
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("the wordmark at the foot of the page on a phone", () => {
	it("shows all of the letters on a phone, not three quarters, and keeps the cut off look from a tablet up", () => {
		screenWith({ noHover: false });
		const { container } = render(<Footer />);
		const box = container.querySelector("svg[role=img]")?.parentElement as HTMLElement;
		expect(box.className).toContain("aspect-(--shown)");
		expect(box.className).toContain("max-sm:aspect-(--full)");
		const shown = box.style.getPropertyValue("--shown");
		const full = box.style.getPropertyValue("--full");
		expect(shown).toBe("1054 / 116");
		expect(full).toBe("1054 / 175");
	});

	it("leaves room under it for the browser's own bottom bar, so that bar never covers the letters", () => {
		screenWith({ noHover: false });
		const { container } = render(<Footer />);
		const footer = container.querySelector("footer") as HTMLElement;
		expect(footer.className).toContain(
			"max-sm:pb-[calc(env(safe-area-inset-bottom)+max(3.5rem,100lvh-100svh))]",
		);
	});

	it("lights itself on a screen with no hover: the pearl light is on and sweeps across the letters, again and again", () => {
		screenWith({ noHover: true });
		const { container } = render(<Footer />);
		const lit = container.querySelector("[data-lit]") as SVGGElement;
		expect(lit.style.opacity).toBe("1");
		const sweep = container.querySelector("[data-spot] animate") as SVGAnimateElement;
		expect(sweep).not.toBeNull();
		expect(sweep.getAttribute("attributeName")).toBe("cx");
		expect(sweep.getAttribute("repeatCount")).toBe("indefinite");
	});

	it("draws the outline brighter there too, since a phone is held further from the eyes", () => {
		screenWith({ noHover: true });
		const { container } = render(<Footer />);
		const base = container.querySelector("[data-layer]:not([data-lit] [data-layer]) path");
		expect(base?.getAttribute("stroke")).toBe("oklch(1 0 0 / 0.3)");
	});

	it("stays as it was with a mouse: dark until the cursor arrives, no animation, the same faint outline", () => {
		screenWith({ noHover: false });
		const { container } = render(<Footer />);
		const lit = container.querySelector("[data-lit]") as SVGGElement;
		expect(lit.style.opacity).toBe("0");
		expect(container.querySelector("[data-spot] animate")).toBeNull();
		const base = container.querySelector("[data-layer]:not([data-lit] [data-layer]) path");
		expect(base?.getAttribute("stroke")).toBe("oklch(1 0 0 / 0.16)");
	});

	it("does not move for anyone who asked for less motion, though the light still shows", () => {
		screenWith({ noHover: true, reducedMotion: true });
		const { container } = render(<Footer />);
		expect(container.querySelector("[data-spot] animate")).toBeNull();
	});
});

describe("the page's own head", () => {
	const html = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"),
		"utf8",
	);

	it("lets the page run under the browser's bars and takes their color from the page, so they read as part of it", () => {
		expect(html).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
		expect(html).toMatch(/name="theme-color" content="#000000"/);
	});
});
