import { DOC_PAGES } from "./docs/catalog.ts";
import { contentFor } from "./i18n/content.ts";

/**
 * The addresses that have something on them: the front page, the legal documents, the articles, and the three pages
 * written by hand. The sitemap lists exactly these, and a test keeps the two in step, so a blank page is never offered
 * to a search engine.
 */
export const CONTENT_PATHS = [
	...new Set([
		"/",
		...Object.keys(contentFor("en").documents),
		...Object.keys(contentFor("en").articles),
		"/contact",
		"/support",
		"/brand",
		"/papers",
		"/live",
		...DOC_PAGES.map((page) => page.path),
	]),
];
