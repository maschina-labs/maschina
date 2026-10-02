/**
 * The papers, from the master files in the repository's papers folder. A file named "03-Protocol-and-
 * Architecture.pdf" is paper 3, "Protocol and Architecture", served at /papers/protocol-and-architecture.pdf.
 * Adding a file there adds it to the app, in its number's place; nothing else needs touching.
 */

export type Paper = { number: number; title: string; slug: string; file: string };
export type PaperListing = Paper & { pages: number };

// Small words stay small inside a title, the way the papers themselves are titled.
const SMALL = new Set(["and", "on", "of", "the", "to", "in", "a", "for"]);

export function paperFrom(file: string): Paper | undefined {
	const match = /^(\d+)-(.+)\.pdf$/i.exec(file);
	if (!match?.[1] || !match[2]) return undefined;
	const words = match[2].split("-").map((word) => word.toLowerCase());
	const title = words
		.map((word, index) =>
			index > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
	return { number: Number(match[1]), title, slug: words.join("-"), file };
}

/** How many pages a PDF has: its page objects, not the page tree ("/Type /Pages") that holds them. */
export function pagesIn(pdf: Uint8Array): number {
	const text = new TextDecoder("latin1").decode(pdf);
	return text.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
}
