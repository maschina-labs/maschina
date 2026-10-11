import { useEffect } from "react";
import { ArticlePage } from "./article.tsx";
import { BlankPage } from "./blank-page.tsx";
import { BrandPage } from "./brand-page.tsx";
import { ContactPage } from "./contact-page.tsx";
/**
 * Which page an address shows: the front page at the root, a blank page for each address in routes.ts that has nothing
 * on it yet, and a page saying there is none for any other address. The address is a plain argument so a test can stand in
 * for the browser's.
 */
import { CONTENT_PATHS } from "./content-paths.ts";
import { contentFor } from "./i18n/content.ts";
import { readLanguage } from "./i18n/language.ts";
import { AVAILABLE } from "./i18n/languages.ts";
import { LocaleContext } from "./i18n/locale-context.tsx";
import { LOCALES, type LocaleCode, parsePath } from "./i18n/locales.ts";
import { label } from "./i18n/messages.ts";
import { redirectFor } from "./i18n/redirect.ts";
import { useMessages } from "./i18n/use-messages.ts";
import { LegalPage } from "./legal.tsx";
import { NotFoundPage } from "./not-found-page.tsx";
import { PapersPage } from "./papers-page.tsx";
import { titleFor } from "./routes.ts";
import { Site } from "./site.tsx";
import { SupportPage } from "./support-page.tsx";
import { useMeta } from "./use-meta.ts";

export { CONTENT_PATHS };

/** The page for an address, with the language already taken off it. */
function Page({ authUrl, clean, locale }: { authUrl: string; clean: string; locale: LocaleCode }) {
	const m = useMessages();
	const content = contentFor(locale);
	const doc = content.documents[clean];
	if (doc) return <LegalPage authUrl={authUrl} doc={doc} englishPath={clean} />;
	if (clean === "/contact") return <ContactPage authUrl={authUrl} />;
	if (clean === "/brand") return <BrandPage authUrl={authUrl} doc={content.brand} />;
	if (clean === "/papers") return <PapersPage authUrl={authUrl} doc={content.papers} />;
	if (clean === "/support") return <SupportPage authUrl={authUrl} doc={content.support} />;
	const article = content.articles[clean];
	if (article)
		return <ArticlePage authUrl={authUrl} doc={article} tab={label(m, titleFor(clean) ?? clean)} />;
	const title = titleFor(clean);
	if (title) return <BlankPage authUrl={authUrl} title={label(m, title)} />;
	if (clean === "/") return <Site authUrl={authUrl} />;
	return <NotFoundPage authUrl={authUrl} />;
}

/**
 * Sets what a page tells the browser about its language: the language tag and the reading direction on the whole
 * document, which are put back when the page goes.
 */
function useLanguageAttributes(locale: LocaleCode) {
	useEffect(() => {
		const html = document.documentElement;
		const before = { lang: html.lang, dir: html.dir };
		const language = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];
		html.lang = language.tag;
		html.dir = language.dir;
		return () => {
			html.lang = before.lang || "en";
			html.dir = before.dir || "ltr";
		};
	}, [locale]);
}

/**
 * Which page an address shows, in which language. The language is the first part of the address (`/es/terms`) if it names
 * one that is ready, and English otherwise. Nothing the browser or the network says about the visitor picks it: only
 * the address, and the visitor's own saved choice (see redirectFor). The rest is the page: the front page at the root, a
 * blank page for each address in routes.ts that has nothing on it yet, and a page saying there is none for any other
 * address. The address is a plain argument so a test can stand in for the browser's.
 */
export function App({
	authUrl,
	path = window.location.pathname,
	available = AVAILABLE,
}: {
	authUrl: string;
	path?: string;
	/** The languages that are ready. A test can say more than the site does yet. */
	available?: readonly LocaleCode[];
}) {
	const parsed = parsePath(path);
	const locale = available.includes(parsed.locale) ? parsed.locale : "en";
	const clean = parsed.path;
	useMeta(clean, CONTENT_PATHS.includes(clean), locale, available);
	useLanguageAttributes(locale);

	// Only the real address of the browser is ever moved: a test that passes its own address is left where it is.
	useEffect(() => {
		if (path !== window.location.pathname) return;
		const { pathname, search, hash } = window.location;
		const target = redirectFor(pathname, search, hash, readLanguage(), available);
		if (target) window.location.replace(target);
	}, [path, available]);

	return (
		<LocaleContext.Provider value={locale}>
			<Page authUrl={authUrl} clean={clean} locale={locale} />
		</LocaleContext.Provider>
	);
}
