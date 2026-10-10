import { CONTENTS } from "./content.ts";
import { LOCALES, type LocaleCode } from "./locales.ts";
import { CATALOGS } from "./messages.ts";
import { build, type Seal, type Translation } from "./translate.ts";

const translations = import.meta.glob<{ default: Translation }>("./translations/*.ts");
const seals = import.meta.glob<{ default: Seal }>("./translations/*.seal.json");

/**
 * The languages that are ready: English, and every language that has a translation file. A language is a file in
 * translations/ and a fingerprint file beside it, written whole, so adding one is adding two files and nothing else.
 */
export const AVAILABLE: readonly LocaleCode[] = [
	"en",
	...LOCALES.map((locale) => locale.code).filter(
		(code) =>
			code !== "en" &&
			`./translations/${code}.ts` in translations &&
			`./translations/${code}.seal.json` in seals,
	),
];

/**
 * Loads a language, once, before the page is drawn. Its words come as a separate file, so a visitor reading English never
 * downloads another language. Anything missing or out of date falls back to the English sentence it was made from.
 */
export async function loadLanguage(code: LocaleCode): Promise<void> {
	if (code === "en" || CATALOGS[code]) return;
	const [translation, seal] = [
		translations[`./translations/${code}.ts`],
		seals[`./translations/${code}.seal.json`],
	];
	if (!translation || !seal) return;
	const [{ default: words }, { default: stamps }] = await Promise.all([translation(), seal()]);
	const built = build(words, stamps);
	CATALOGS[code] = built.messages;
	CONTENTS[code] = built.content;
}
