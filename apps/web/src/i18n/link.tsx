import { useLocale } from "./locale-context.tsx";
import { localizePath } from "./locales.ts";

/**
 * A link that keeps the language of the page it is on. A page of the site is sent to the same page in that language;
 * anything else (another site, a mailto, a fragment, a plain file or a download) is left exactly as it was. Every link
 * in the site goes through here, so a reader who chose a language stays in it from page to page.
 */
export function Link({
	href,
	...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href?: string | undefined }) {
	const locale = useLocale();
	// With no address it is not a link yet (a page tagged Soon), and stays as it was.
	return <a href={href === undefined ? undefined : localizePath(href, locale)} {...rest} />;
}
