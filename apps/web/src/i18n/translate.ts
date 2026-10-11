import type { Content } from "./content.ts";
import { contentFor } from "./content.ts";
import { en } from "./en.ts";
import type { Messages } from "./messages.ts";
import {
	mapArticleDoc,
	mapBrand,
	mapLegal,
	mapPapers,
	mapStrings,
	mapSupport,
	type Say,
} from "./walk.ts";

/**
 * A language, as the plain lists of words a translator writes: the catalog's strings, then the words of each page, each
 * in the fixed order of the walk in walk.ts. There is nothing else in it: no address, no file, no structure, so a
 * translation cannot change what a page does.
 */
export type Translation = {
	catalog: string[];
	documents: Record<string, string[]>;
	articles: Record<string, string[]>;
	support: string[];
	papers: string[];
	brand: string[];
};

/** The same lists, but each word is the fingerprint of the English it was written from. */
export type Seal = Translation;

/** A short fingerprint of an English sentence. Not secret: it only tells whether the English has changed since. */
export function hash(text: string): string {
	let value = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 0x01000193) >>> 0;
	}
	return value.toString(16).padStart(8, "0");
}

const collect = <T>(map: (value: T, say: Say) => T, value: T): string[] => {
	const seen: string[] = [];
	map(value, (text) => {
		seen.push(text);
		return text;
	});
	return seen;
};

/** The English, in the shape of a translation: what a translator is given to put into another language. */
export function sourcesOf(): Translation {
	const english = contentFor("en");
	const each = <T>(table: Record<string, T>, map: (value: T, say: Say) => T) =>
		Object.fromEntries(Object.entries(table).map(([path, doc]) => [path, collect(map, doc)]));
	return {
		catalog: collect(mapStrings, en),
		documents: each(english.documents, mapLegal),
		articles: each(english.articles, mapArticleDoc),
		support: collect(mapSupport, english.support),
		papers: collect(mapPapers, english.papers),
		brand: collect(mapBrand, english.brand),
	};
}

/** The fingerprints of the English as it is now, to be kept beside a translation made from it. */
export function sealOf(): Seal {
	const sources = sourcesOf();
	const stamp = (words: string[]) => words.map(hash);
	const stampAll = (table: Record<string, string[]>) =>
		Object.fromEntries(Object.entries(table).map(([path, words]) => [path, stamp(words)]));
	return {
		catalog: stamp(sources.catalog),
		documents: stampAll(sources.documents),
		articles: stampAll(sources.articles),
		support: stamp(sources.support),
		papers: stamp(sources.papers),
		brand: stamp(sources.brand),
	};
}

/**
 * The words to use for each English sentence: its translation, unless the translation is missing, empty, or was made from
 * English that has since changed. In those cases it is the English itself, so a reader is never shown a translation of a
 * sentence that no longer says that, and a gap is never blank.
 */
function resolve(
	source: string[],
	words: string[] | undefined,
	stamps: string[] | undefined,
): { words: string[]; stale: number } {
	let stale = 0;
	const out = source.map((english, index) => {
		const translated = words?.[index];
		const fresh = stamps?.[index] === hash(english);
		if (typeof translated === "string" && translated.trim() !== "" && fresh) return translated;
		stale++;
		return english;
	});
	return { words: out, stale };
}

/** The catalog and the pages in a language, built from its words, and how many sentences fell back to English. */
export function build(
	translation: Translation,
	seal: Seal,
): { messages: Messages; content: Content; stale: number } {
	const sources = sourcesOf();
	const english = contentFor("en");
	let stale = 0;
	const say = (resolved: { words: string[]; stale: number }): Say => {
		stale += resolved.stale;
		let index = 0;
		return () => resolved.words[index++] ?? "";
	};
	const messages = mapStrings(
		en,
		say(resolve(sources.catalog, translation.catalog, seal.catalog)),
	) as Messages;
	const table = <T>(
		docs: Record<string, T>,
		from: Record<string, string[]>,
		translated: Record<string, string[]>,
		stamps: Record<string, string[]>,
		map: (value: T, say: Say) => T,
	) =>
		Object.fromEntries(
			Object.entries(docs).map(([path, doc]) => [
				path,
				map(doc, say(resolve(from[path] ?? [], translated[path], stamps[path]))),
			]),
		);
	const content: Content = {
		documents: table(
			english.documents,
			sources.documents,
			translation.documents,
			seal.documents,
			mapLegal,
		),
		articles: table(
			english.articles,
			sources.articles,
			translation.articles,
			seal.articles,
			mapArticleDoc,
		),
		support: mapSupport(
			english.support,
			say(resolve(sources.support, translation.support, seal.support)),
		),
		papers: mapPapers(
			english.papers,
			say(resolve(sources.papers, translation.papers, seal.papers)),
		),
		brand: mapBrand(english.brand, say(resolve(sources.brand, translation.brand, seal.brand))),
	};
	return { messages, content, stale };
}
