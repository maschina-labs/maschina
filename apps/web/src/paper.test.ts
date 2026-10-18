import { describe, expect, it } from "vitest";
import { parsePaper } from "./paper.ts";

describe("reading a paper out of its markdown", () => {
	it("takes the front matter off the top", () => {
		const paper = parsePaper(`---
title: Maschina
subtitle: The operating system for autonomous capital
running: Primer
abstract: The whole argument in one page.
---

## The problem

Give an automated trader your money.
`);

		expect(paper.meta["running"]).toBe("Primer");
		expect(paper.meta["subtitle"]).toBe("The operating system for autonomous capital");
		expect(paper.meta["abstract"]).toBe("The whole argument in one page.");
		// The front matter is not also content.
		expect(JSON.stringify(paper.blocks)).not.toContain("subtitle");
	});

	it("joins the lines of a paragraph, because markdown wraps them and a page does not", () => {
		const paper = parsePaper("## H\n\nOne line\nand its continuation.\n");

		expect(paper.blocks[1]).toEqual({
			kind: "paragraph",
			parts: [{ text: "One line and its continuation." }],
		});
	});

	it("reads a heading", () => {
		expect(parsePaper("## What Maschina does\n").blocks[0]).toEqual({
			kind: "heading",
			text: "What Maschina does",
		});
	});

	it("reads bold, links and code inside a paragraph", () => {
		const paper = parsePaper("Plain **bold** then [a link](https://x.test) and `code`.\n");

		expect(paper.blocks[0]).toEqual({
			kind: "paragraph",
			parts: [
				{ text: "Plain " },
				{ text: "bold", bold: true },
				{ text: " then " },
				{ text: "a link", href: "https://x.test" },
				{ text: " and " },
				{ text: "code", code: true },
				{ text: "." },
			],
		});
	});

	it("reads a bulleted list", () => {
		const paper = parsePaper("- one\n- two **bold**\n");

		expect(paper.blocks[0]).toEqual({
			kind: "list",
			ordered: false,
			items: [[{ text: "one" }], [{ text: "two " }, { text: "bold", bold: true }]],
		});
	});

	it("reads a numbered list, and keeps it numbered", () => {
		expect(parsePaper("1. first\n2. second\n").blocks[0]).toMatchObject({
			kind: "list",
			ordered: true,
		});
	});

	it("reads a table, and drops the dashes row that is only there to draw it", () => {
		const paper = parsePaper("| Source | Basis |\n| --- | --- |\n| Fees | Per trade |\n");

		expect(paper.blocks[0]).toEqual({
			kind: "table",
			head: [[{ text: "Source" }], [{ text: "Basis" }]],
			rows: [[[{ text: "Fees" }], [{ text: "Per trade" }]]],
		});
	});

	it("reads a figure, keeping its caption, which is the whole alt text", () => {
		const paper = parsePaper(
			"![Figure 1. The services, and the boundaries between them.](figures/fig-01-architecture.png)\n",
		);

		expect(paper.blocks[0]).toEqual({
			kind: "figure",
			src: "figures/fig-01-architecture.png",
			caption: "Figure 1. The services, and the boundaries between them.",
		});
	});

	it("keeps blocks in the order they were written", () => {
		const paper = parsePaper("## H\n\nText.\n\n- a\n\n| x |\n| --- |\n| y |\n");

		expect(paper.blocks.map((block) => block.kind)).toEqual([
			"heading",
			"paragraph",
			"list",
			"table",
		]);
	});

	it("reads a real paper without losing anything to an unknown line", () => {
		// Every line of every paper has to land in some block. A line silently dropped is a
		// sentence missing from a published document, and nothing would say so.
		const paper = parsePaper("## H\n\nOne.\n\nTwo.\n");

		expect(paper.blocks).toHaveLength(3);
	});
});
