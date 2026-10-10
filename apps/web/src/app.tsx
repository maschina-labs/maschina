import { type ArticleDoc, ArticlePage } from "./article.tsx";
import { BlankPage } from "./blank-page.tsx";
import { BrandPage } from "./brand-page.tsx";
import { ABOUT } from "./company/about.ts";
import { BRAND } from "./company/brand.ts";
import { ROADMAP } from "./company/roadmap.ts";
import { SUPPORT } from "./company/support.ts";
import { ContactPage } from "./contact-page.tsx";
import { ACCEPTABLE_USE } from "./legal/acceptable-use.ts";
import { DISCLOSURE } from "./legal/disclosure.ts";
import { LICENSE } from "./legal/license.ts";
import { PRIVACY } from "./legal/privacy.ts";
import { RISK } from "./legal/risk.ts";
import { TERMS } from "./legal/terms.ts";
import { type LegalDoc, LegalPage } from "./legal.tsx";
import { NotFoundPage } from "./not-found-page.tsx";
import { titleFor } from "./routes.ts";
import { Site } from "./site.tsx";
import { SupportPage } from "./support-page.tsx";
import { useMeta } from "./use-meta.ts";

/**
 * Which page an address shows: the front page at the root, a blank page for each address in routes.ts that has nothing
 * on it yet, and a page saying there is none for any other address. The address is a plain argument so a test can stand in
 * for the browser's.
 */
/** The legal documents, each at its address. They are written out in full; the other pages are blank. */
const DOCUMENTS: Record<string, LegalDoc> = {
	"/terms": TERMS,
	"/privacy": PRIVACY,
	"/risk": RISK,
	"/acceptable-use": ACCEPTABLE_USE,
	"/license": LICENSE,
	"/disclosure": DISCLOSURE,
};

/** The company pages, which read like articles, each at its address. */
const ARTICLES: Record<string, ArticleDoc> = {
	"/about": ABOUT,
	"/roadmap": ROADMAP,
};

/**
 * The addresses that have something on them: the front page, the legal documents, the articles, and the three pages
 * written by hand. The sitemap lists exactly these, and a test keeps the two in step, so a blank page is never offered
 * to a search engine.
 */
export const CONTENT_PATHS = [
	"/",
	...Object.keys(DOCUMENTS),
	...Object.keys(ARTICLES),
	"/contact",
	"/support",
	"/brand",
];

export function App({
	authUrl,
	path = window.location.pathname,
}: {
	authUrl: string;
	path?: string;
}) {
	const clean = path.replace(/\/+$/, "") || "/";
	useMeta(clean, CONTENT_PATHS.includes(clean));
	const doc = DOCUMENTS[clean];
	if (doc) return <LegalPage authUrl={authUrl} doc={doc} />;
	if (clean === "/contact") return <ContactPage authUrl={authUrl} />;
	if (clean === "/brand") return <BrandPage authUrl={authUrl} doc={BRAND} />;
	if (clean === "/support") return <SupportPage authUrl={authUrl} doc={SUPPORT} />;
	const article = ARTICLES[clean];
	if (article) return <ArticlePage authUrl={authUrl} doc={article} tab={titleFor(clean)} />;
	const title = titleFor(path);
	if (title) return <BlankPage authUrl={authUrl} title={title} />;
	if (clean === "/") return <Site authUrl={authUrl} />;
	return <NotFoundPage authUrl={authUrl} />;
}
