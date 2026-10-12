import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Builders } from "./builders.tsx";
import { SOCIALS } from "./socials.ts";

const section = () => screen.getByRole("region", { name: "For Builders" });

describe("the section for builders", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("is a chapter: its headline is left-aligned, in the pearl gradient with the thin outline", () => {
		render(<Builders />);
		const heading = within(section()).getByRole("heading", { level: 2, name: "Read every line." });
		for (const part of [
			"text-left",
			"bg-clip-text",
			"text-transparent",
			"[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]",
			"pb-[0.14em]",
			"-mb-[0.14em]",
		])
			expect(heading.className).toContain(part);
		expect(heading.className).not.toContain("text-center");
	});

	it("says one true thing in one gray line: the code is source-available", () => {
		render(<Builders />);
		const lines = section().querySelectorAll("p");
		expect(lines).toHaveLength(1);
		expect(lines[0]?.textContent).toBe(
			"Maschina is source-available. Read the code and see exactly what a machine can and cannot do.",
		);
		expect(lines[0]?.className).toContain("text-neutral-400");
		expect(lines[0]?.className).toContain("text-left");
	});

	it("has two buttons, the code and the docs, the same two kinds as the hero's", () => {
		render(<Builders />);
		const github = SOCIALS.find((social) => social.label === "Maschina on GitHub")?.href;
		const code = within(section()).getByRole("link", { name: "View the code" });
		expect(code).toHaveAttribute("href", github);
		expect(code.className).toContain("bg-[oklch(0.93_0.02_300)]");
		const docs = within(section()).getByRole("link", { name: "Read the docs" });
		expect(docs).toHaveAttribute("href", "https://docs.maschina.dev");
		expect(docs.className).toContain("bg-white/[0.13]");
		expect(within(section()).getAllByRole("link")).toHaveLength(2);
	});

	it("promises nothing that is not built: no SDK, package, key, MCP server or skill file", () => {
		render(<Builders />);
		expect(section().textContent ?? "").not.toMatch(
			/\bsdk\b|npm|package|install|api key|mcp|skill|plugin|open source|audit/i,
		);
	});

	it("sits between the page margins on black, square, with no image and no canvas", () => {
		const { container } = render(<Builders />);
		expect(section().className).toContain("bg-black");
		expect(section().className).toContain("px-(--gutter)");
		expect(section().className).toContain("overflow-hidden");
		expect(container.innerHTML).not.toMatch(/rounded|<canvas|<img/);
	});

	it("has Rust code streaming down the left behind it, blurred past reading, hidden from assistive technology and from the pointer", () => {
		const { container } = render(<Builders />);
		const code = container.querySelector("[data-code]") as HTMLElement;
		expect(code).toHaveAttribute("aria-hidden", "true");
		expect(code.className).toContain("pointer-events-none");
		// Strongest at the left edge, gone before the right.
		expect(code.className).toMatch(/mask-image:linear-gradient\(to_right/);
		expect(code.className).toContain("blur-");
		const columns = [...container.querySelectorAll("[data-stream]")];
		// One page of code, not two layers: a second column made the motion busy.
		expect(columns).toHaveLength(1);
		for (const column of columns) {
			expect(column.className).toContain("animate-stream");
			expect(column.className).toContain("motion-reduce:animate-none");
			// It is written twice, so the loop has no seam, and it is Rust.
			const text = column.textContent ?? "";
			const first = text.indexOf("pub struct Limits");
			expect(first).toBeGreaterThanOrEqual(0);
			expect(text.indexOf("pub struct Limits", first + 1)).toBeGreaterThan(first);
			expect(text).toMatch(/\bfn \w+\(&self/);
			expect(text).toMatch(/Result<\(\), Refusal>/);
		}
	});

	it("keeps everything, the code included, inside the page margins, on the same edges as every other chapter", () => {
		const { container } = render(<Builders />);
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("max-w-[72rem]");
		expect(frame.className).toContain("mx-auto");
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.parentElement).toBe(section());
		for (const part of ["[data-code]", "[data-fog]", "h2"]) {
			expect(frame.querySelector(part), part).not.toBeNull();
		}
		// Nothing of the section is a direct child of the page-wide section except the frame.
		expect([...section().children]).toEqual([frame]);
	});

	it("is not part of what is read aloud or counted as the section's words", () => {
		render(<Builders />);
		expect(within(section()).getAllByRole("heading")).toHaveLength(1);
	});

	it("has no panel around the words: the whole section is the foggy glass, and the words sit straight on it", () => {
		const { container } = render(<Builders />);
		expect(container.querySelector("[data-glass]")).toBeNull();
		const heading = screen.getByRole("heading", { level: 2 });
		for (let node = heading.parentElement; node && node !== section(); node = node.parentElement) {
			expect(node.className, node.className).not.toMatch(/outline|bg-white|backdrop-blur/);
		}
	});

	it("lays a sheet of frosted glass over the whole section, between the code and the words", () => {
		const { container } = render(<Builders />);
		const fog = container.querySelector("[data-fog]") as HTMLElement;
		expect(fog).toHaveAttribute("aria-hidden", "true");
		expect(fog.className).toContain("backdrop-blur");
		expect(fog.className).toContain("inset-0");
		expect(fog.className).toContain("pointer-events-none");
		const code = container.querySelector("[data-code]") as HTMLElement;
		const words = screen.getByRole("heading", { level: 2 });
		expect(code.compareDocumentPosition(fog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(fog.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("looks like a real source file: numbered lines, comments, keywords, types and strings, each in its own soft color", () => {
		const { container } = render(<Builders />);
		const column = container.querySelector("[data-stream]") as HTMLElement;
		const lines = column.querySelectorAll("[data-line]");
		expect(lines.length).toBeGreaterThan(90);
		expect(lines[0]?.querySelector("[data-gutter]")?.textContent).toBe("1");
		expect(lines[1]?.querySelector("[data-gutter]")?.textContent).toBe("2");
		for (const kind of ["comment", "keyword", "type", "string", "macro"]) {
			expect(column.querySelector(`[data-token="${kind}"]`), kind).not.toBeNull();
		}
		const text = column.textContent ?? "";
		for (const real of ["async fn", "impl ", "#[derive(", "match ", "#[cfg(test)]", "///", "->"]) {
			expect(text, real).toContain(real);
		}
	});

	it("stops the code while the section is off screen, and runs it when the section is near", () => {
		let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: typeof notify) {
					notify = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		const { container } = render(<Builders />);
		const code = container.querySelector("[data-code]") as HTMLElement;
		expect(code).toHaveAttribute("data-live", "false");
		expect((container.querySelector("[data-stream]") as HTMLElement).className).toContain(
			"[animation-play-state:paused]",
		);
		act(() => notify([{ isIntersecting: true }]));
		expect(code).toHaveAttribute("data-live", "true");
		act(() => notify([{ isIntersecting: false }]));
		expect(code).toHaveAttribute("data-live", "false");
	});

	it("runs at once where the browser cannot watch for scrolling", () => {
		const { container } = render(<Builders />);
		expect(container.querySelector("[data-code]")).toHaveAttribute("data-live", "true");
	});
});
