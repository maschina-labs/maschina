import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Builders } from "./builders.tsx";
import { SOCIALS } from "./socials.ts";

const section = () => screen.getByRole("region", { name: "For builders" });

describe("the section for builders", () => {
	it("has a left aligned headline in the pearl gradient with the thin outline, like the other headlines", () => {
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
		expect(docs).toHaveAttribute("href", "/docs");
		expect(docs.className).toContain("bg-white/[0.13]");
		expect(within(section()).getAllByRole("link")).toHaveLength(2);
	});

	it("promises nothing that is not built: no SDK, package, key, MCP server or skill file", () => {
		render(<Builders />);
		expect(section().textContent ?? "").not.toMatch(
			/\bsdk\b|npm|package|install|api key|mcp|skill|plugin|open source|audit/i,
		);
	});

	it("sits left aligned between the page margins on black, still and square", () => {
		const { container } = render(<Builders />);
		expect(section().className).toContain("bg-black");
		expect(section().className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded|animate-|<canvas|<img/);
	});
});
