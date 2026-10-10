import { isLocale, type LocaleCode } from "./locales.ts";

/**
 * The language the visitor chose, kept in one first party cookie for a year. It is a functional cookie: it holds only
 * what the visitor picked, and nothing is stored until they pick. Nothing else ever sets the language. In particular the
 * browser's own settings and the visitor's place are never read, so a visitor who sets English stays on English.
 */
const NAME = "maschina_language";
const YEAR = 365 * 24 * 60 * 60;

/** Sent when a choice is saved. */
export const LANGUAGE_CHANGED = "maschina:language-changed";

export function readLanguage(): LocaleCode | null {
	const found = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${NAME}=`));
	const value = found?.slice(NAME.length + 1);
	return isLocale(value) ? value : null;
}

export function saveLanguage(code: LocaleCode): void {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet, and one plain cookie is all this needs
	document.cookie = `${NAME}=${code}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`;
	window.dispatchEvent(new Event(LANGUAGE_CHANGED));
}
