/**
 * The languages Maschina is written in, each under its own name, English first. A language is chosen only by the
 * address (`/es/terms`) and by the visitor's own choice, and never by anything the browser or the network says about
 * them. English has no prefix: it is the address as it is.
 */
export const LOCALES = [
	{ code: "en", name: "English", tag: "en", dir: "ltr" },
	{ code: "es", name: "Español", tag: "es", dir: "ltr" },
	{ code: "fr", name: "Français", tag: "fr", dir: "ltr" },
	{ code: "de", name: "Deutsch", tag: "de", dir: "ltr" },
	{ code: "it", name: "Italiano", tag: "it", dir: "ltr" },
	{ code: "pt", name: "Português", tag: "pt", dir: "ltr" },
	{ code: "nl", name: "Nederlands", tag: "nl", dir: "ltr" },
	{ code: "pl", name: "Polski", tag: "pl", dir: "ltr" },
	{ code: "tr", name: "Türkçe", tag: "tr", dir: "ltr" },
	{ code: "ru", name: "Русский", tag: "ru", dir: "ltr" },
	{ code: "uk", name: "Українська", tag: "uk", dir: "ltr" },
	{ code: "ar", name: "العربية", tag: "ar", dir: "rtl" },
	{ code: "he", name: "עברית", tag: "he", dir: "rtl" },
	{ code: "hi", name: "हिन्दी", tag: "hi", dir: "ltr" },
	{ code: "bn", name: "বাংলা", tag: "bn", dir: "ltr" },
	{ code: "zh", name: "简体中文", tag: "zh-CN", dir: "ltr" },
	{ code: "zh-tw", name: "繁體中文", tag: "zh-TW", dir: "ltr" },
	{ code: "ja", name: "日本語", tag: "ja", dir: "ltr" },
	{ code: "ko", name: "한국어", tag: "ko", dir: "ltr" },
	{ code: "id", name: "Bahasa Indonesia", tag: "id", dir: "ltr" },
	{ code: "vi", name: "Tiếng Việt", tag: "vi", dir: "ltr" },
	{ code: "th", name: "ไทย", tag: "th", dir: "ltr" },
	{ code: "fil", name: "Filipino", tag: "fil", dir: "ltr" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: LocaleCode = "en";

const CODES: ReadonlySet<string> = new Set(LOCALES.map((locale) => locale.code));

export const isLocale = (value: string | undefined | null): value is LocaleCode =>
	Boolean(value && CODES.has(value));

/** The language an address asks for, and the page it asks for without the language. */
export function parsePath(pathname: string): { locale: LocaleCode; path: string } {
	const clean = pathname.replace(/\/+$/, "") || "/";
	const [, first = "", ...rest] = clean.split("/");
	// English is the address as it is, so "/en/..." is not a language prefix: it is a page that does not exist.
	if (first !== DEFAULT_LOCALE && isLocale(first)) {
		return { locale: first, path: rest.length ? `/${rest.join("/")}` : "/" };
	}
	return { locale: DEFAULT_LOCALE, path: clean };
}

/** Folders of files and the plain files themselves: never given a language, since there is one of each. */
const NOT_PAGES = ["/brand/", "/fonts/", "/showcase/", "/.well-known/", "/assets/"];

/**
 * An address with a language in front of it. Another site, a mailto, a fragment and a file are not pages, and come back
 * as they were. English comes back with no prefix. A search and a fragment stay where they were.
 */
export function localizePath(href: string, locale: LocaleCode): string {
	if (!href.startsWith("/") || href.startsWith("//")) return href;
	const cut = href.search(/[?#]/);
	const path = cut === -1 ? href : href.slice(0, cut);
	const tail = cut === -1 ? "" : href.slice(cut);
	const last = path.split("/").at(-1) ?? "";
	if (NOT_PAGES.some((folder) => path.startsWith(folder)) || last.includes(".")) return href;
	const page = parsePath(path).path;
	if (locale === DEFAULT_LOCALE) return `${page}${tail}`;
	return `${page === "/" ? `/${locale}` : `/${locale}${page}`}${tail}`;
}
