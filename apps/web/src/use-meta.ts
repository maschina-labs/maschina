import { useEffect } from "react";

const ORIGIN = "https://maschina.dev";

/**
 * Tells search engines what this page is: its own address, which keeps a page with and without a trailing slash from
 * counting twice, and, for a page with nothing on it, to leave it out of search results. What the page found in the
 * head is put back when it goes, and what it added is taken away.
 */
export function useMeta(path: string, indexable: boolean) {
	useEffect(() => {
		const head = document.head;
		const href = path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`;

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

		return () => {
			robots?.remove();
			if (madeLink) link.remove();
			else if (before !== null) link.setAttribute("href", before);
		};
	}, [path, indexable]);
}
