import { en } from "./en.ts";
import type { LocaleCode } from "./locales.ts";

/** Any string in a catalog is just a string, so another language can say it in its own words. */
type Widen<T> = T extends string
	? string
	: T extends readonly (infer Item)[]
		? readonly Widen<Item>[]
		: T extends object
			? { [Key in keyof T]: Widen<T[Key]> }
			: T;

export type Messages = Widen<typeof en>;

/**
 * Every language that has its words, each complete: a language is written in full or not at all, so there is never a page
 * with some of its words in one language and some in another. English is the source, and every other language is held to
 * its exact shape by a test.
 */
export const CATALOGS: Partial<Record<LocaleCode, Messages>> = { en };

/** The name of a page, a menu or a column in a language: its entry in the catalog, or the English name it was given. */
export const label = (messages: Messages, name: string): string => messages.labels[name] ?? name;

/** The words for a language, and English for a language that has none yet. */
export function messagesFor(locale: LocaleCode): Messages {
	return CATALOGS[locale] ?? en;
}

/** Puts values into a sentence where the braces are: `fill("Updated {date}", { date })`. A brace with no value stays. */
export function fill(text: string, values: Record<string, string | number>): string {
	return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
		key in values ? String(values[key]) : whole,
	);
}
