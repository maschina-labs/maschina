import { useEffect } from "react";
import { LOCALES, type LocaleCode, localizePath } from "./i18n/locales.ts";

const ORIGIN = "https://maschina.dev";

/**
 * Tells search engines what this page is: its own address, which keeps a page with and without a trailing slash from
 * counting twice, and, for a page with nothing on it, to leave it out of search results. What the page found in the
 * head is put back when it goes, and what it added is taken away.
 */
export function useMeta(
	path: string,
	indexable: boolean,
	locale: LocaleCode = "en",
	available: readonly LocaleCode[] = ["en"],
) {
	useEffect(() => {
		const head = document.head;
		const address = (code: LocaleCode) => {
			const page = localizePath(path, code);
			return page === "/" ? `${ORIGIN}/` : `${ORIGIN}${page}`;
		};
		const href = address(locale);

		let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
		const madeLink = !link;
		const before = link?.getAttribute("href") ?? null;
		if (!link) {
			link = document.createElement("link");
			link.rel = "canonical";
			head.append(link);
		}
		link.setAttribute("href", href);

		let robots: HTMLMetaElement | null = null;
		if (!indexable) {
			robots = document.createElement("meta");
			robots.name = "robots";
			robots.content = "noindex";
			head.append(robots);
		}

		// The same page in every ready language, so a search engine offers each reader their own. Only once there is more
		// than one, and with English as the fallback for anyone else.
		const alternates: HTMLLinkElement[] = [];
		if (available.length > 1) {
			for (const code of available) {
				const alternate = document.createElement("link");
				alternate.rel = "alternate";
				alternate.hreflang = LOCALES.find((entry) => entry.code === code)?.tag ?? code;
				alternate.href = address(code);
				alternates.push(alternate);
			}
			const fallback = document.createElement("link");
			fallback.rel = "alternate";
			fallback.hreflang = "x-default";
			fallback.href = address("en");
			alternates.push(fallback);
			head.append(...alternates);
		}

		return () => {
			for (const alternate of alternates) alternate.remove();
			robots?.remove();
			if (madeLink) link.remove();
			else if (before !== null) link.setAttribute("href", before);
		};
	}, [path, indexable, locale, available]);
}
