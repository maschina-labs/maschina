/**
 * A paper, read out of the markdown it is written in.
 *
 * The papers are kept as markdown in the repository so they can be read there, diffed like code and
 * edited without touching a component. The same files are what the site renders and what a PDF is
 * printed from, so the three can never drift: there is one source and no copy of it anywhere.
 *
 * This reads the subset of markdown the papers actually use, which was counted rather than guessed:
 * headings, paragraphs, bulleted and numbered lists, tables, figures, and bold, links and code
 * inside a line. Anything else would be a silent surprise, so an unknown line becomes a paragraph
 * rather than disappearing. A sentence lost here is a sentence missing from a published document,
 * and nothing downstream would notice.
 */

/** A run of text in a line, with at most one thing done to it. */
export type Part = { text: string; bold?: true; code?: true; href?: string };

export type Block =
	| { kind: "heading"; text: string }
	| { kind: "paragraph"; parts: Part[] }
	| { kind: "list"; ordered: boolean; items: Part[][] }
	| { kind: "table"; head: Part[][]; rows: Part[][][] }
	| { kind: "figure"; src: string; caption: string };

export type PaperMeta = Record<string, string>;

export type Paper = { meta: PaperMeta; blocks: Block[] };

const FIGURE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const BULLET = /^[-*] +(.*)$/;
const NUMBERED = /^\d+\. +(.*)$/;
/** A row of dashes under a table's head, which draws the rule and says nothing. */
const RULE = /^\|[\s|:-]+\|$/;

/** Bold, a link, or code: whichever comes first, so they are read left to right. */
const INLINE = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)/;

/** One line of text, split into its runs. Plain text between the marked up bits is kept as it is. */
export function parseInline(line: string): Part[] {
	const parts: Part[] = [];
	let rest = line;
	while (rest) {
		const found = INLINE.exec(rest);
		if (!found) {
			parts.push({ text: rest });
			break;
		}
		if (found.index > 0) parts.push({ text: rest.slice(0, found.index) });
		if (found[2] !== undefined) parts.push({ text: found[2], bold: true });
		else if (found[4] !== undefined) parts.push({ text: found[4], href: found[5] as string });
		else if (found[7] !== undefined) parts.push({ text: found[7], code: true });
		rest = rest.slice(found.index + found[0].length);
	}
	return parts;
}

/** The cells of a table row, without the pipes at either end. */
const cells = (line: string): Part[][] =>
	line
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((cell) => parseInline(cell.trim()));

/** The front matter at the top, between the two rules. Absent, the paper simply has none. */
function frontMatter(lines: string[]): { meta: PaperMeta; body: string[] } {
	if (lines[0]?.trim() !== "---") return { meta: {}, body: lines };
	const end = lines.indexOf("---", 1);
	if (end < 0) return { meta: {}, body: lines };
	const meta: PaperMeta = {};
	for (const line of lines.slice(1, end)) {
		const at = line.indexOf(":");
		if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
	}
	return { meta, body: lines.slice(end + 1) };
}

export function parsePaper(markdown: string): Paper {
	const { meta, body } = frontMatter(markdown.split("\n"));
	const blocks: Block[] = [];
	// A paragraph is written across several lines and read as one, so lines are gathered until a
	// blank one or a line that is plainly something else ends it.
	let paragraph: string[] = [];
	const endParagraph = () => {
		if (paragraph.length > 0) {
			blocks.push({ kind: "paragraph", parts: parseInline(paragraph.join(" ")) });
			paragraph = [];
		}
	};

	for (let i = 0; i < body.length; i++) {
		const line = (body[i] ?? "").trim();

		if (!line) {
			endParagraph();
			continue;
		}

		const heading = /^#{1,6} +(.*)$/.exec(line);
		if (heading) {
			endParagraph();
			blocks.push({ kind: "heading", text: heading[1] as string });
			continue;
		}

		const figure = FIGURE.exec(line);
		if (figure) {
			endParagraph();
			blocks.push({ kind: "figure", src: figure[2] as string, caption: figure[1] as string });
			continue;
		}

		const bullet = BULLET.exec(line);
		const numbered = NUMBERED.exec(line);
		if (bullet || numbered) {
			endParagraph();
			const ordered = Boolean(numbered);
			const items: Part[][] = [];
			// Gather the whole list here rather than one item per block, so the page can number it.
			for (; i < body.length; i++) {
				const at = (body[i] ?? "").trim();
				const next = ordered ? NUMBERED.exec(at) : BULLET.exec(at);
				if (!next) break;
				items.push(parseInline(next[1] as string));
			}
			i -= 1;
			blocks.push({ kind: "list", ordered, items });
			continue;
		}

		if (line.startsWith("|")) {
			endParagraph();
			const rows: Part[][][] = [];
			for (; i < body.length; i++) {
				const at = (body[i] ?? "").trim();
				if (!at.startsWith("|")) break;
				// The rule under the head draws the table and says nothing, so it is not a row.
				if (!RULE.test(at)) rows.push(cells(at));
			}
			i -= 1;
			const [head, ...rest] = rows;
			if (head) blocks.push({ kind: "table", head, rows: rest });
			continue;
		}

		paragraph.push(line);
	}
	endParagraph();

	return { meta, blocks };
}
