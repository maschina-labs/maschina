import type { ArticleDoc } from "../article.tsx";
import { ABOUT } from "../company/about.ts";
import { BRAND, type BrandDoc } from "../company/brand.ts";
import { DOCS } from "../company/docs.ts";
import { PAPERS, type PapersDoc } from "../company/papers.ts";
import { HOW_IT_WORKS, MACHINES, PRODUCT, SECURITY } from "../company/product.ts";
import { ROADMAP } from "../company/roadmap.ts";
import { SUPPORT, type SupportDoc } from "../company/support.ts";
import { ACCEPTABLE_USE } from "../legal/acceptable-use.ts";
import { DISCLOSURE } from "../legal/disclosure.ts";
import { LICENSE } from "../legal/license.ts";
import { PRIVACY } from "../legal/privacy.ts";
import { RISK } from "../legal/risk.ts";
import { TERMS } from "../legal/terms.ts";
import type { LegalDoc } from "../legal.tsx";
import type { LocaleCode } from "./locales.ts";

/** Every page of the site that is written out, by address: the legal documents, the articles, and the three pages made by hand. */
export type Content = {
	documents: Record<string, LegalDoc>;
	articles: Record<string, ArticleDoc>;
	support: SupportDoc;
	papers: PapersDoc;
	brand: BrandDoc;
};

const english: Content = {
	documents: {
		"/terms": TERMS,
		"/privacy": PRIVACY,
		"/risk": RISK,
		"/acceptable-use": ACCEPTABLE_USE,
		"/license": LICENSE,
		"/disclosure": DISCLOSURE,
	},
	articles: {
		"/about": ABOUT,
		"/roadmap": ROADMAP,
		"/product": PRODUCT,
		"/how-it-works": HOW_IT_WORKS,
		"/machines": MACHINES,
		"/security": SECURITY,
		"/docs": DOCS,
	},
	support: SUPPORT,
	papers: PAPERS,
	brand: BRAND,
};

/**
 * The pages in every language that has them, each whole: a language has all of its pages or none, so a reader is never
 * given half a document in one language. A test holds each one to the exact skeleton of English (the same sections,
 * the same kinds of block, every link going to the same place), so a translation cannot change what a page does.
 */
export const CONTENTS: Partial<Record<LocaleCode, Content>> = { en: english };

/** The pages in a language, and in English for a language that has none yet. */
export const contentFor = (locale: LocaleCode): Content => CONTENTS[locale] ?? english;
