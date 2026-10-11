import { DOCS_PAGES } from "./links.ts";
import { MENUS } from "./menus.ts";
import { leavesSite } from "./routes.ts";

type Entry = { label: string; href?: string; action?: "preferences" };

/** A link with no address is not built yet and shows as Soon. One with a full address leaves the site. */
type Link = Entry & { external: boolean };

/** One column of the footer's sitemap. */
export type Column = { title: string; items: Link[] };

/**
 * Takes an address once: the first column to list a page keeps it, so a page never appears twice. The pages
 * not built yet go last, in the order they were given, so a column reads built pages first.
 */
function once(items: Entry[], taken: Set<string>): Link[] {
	const fresh = items.filter((item) => {
		if (!item.href) return true;
		if (taken.has(item.href)) return false;
		taken.add(item.href);
		return true;
	});
	// A link that does something instead of going somewhere (Preferences) is as built as a page is.
	const built = (item: Entry) => Boolean(item.href || item.action);
	const ordered = [...fresh.filter(built), ...fresh.filter((item) => !built(item))];
	return ordered.map((item) => ({ ...item, external: item.href ? leavesSite(item.href) : false }));
}

const taken = new Set<string>();
const menu = (name: string) => MENUS[name];

/**
 * The footer's map of the site, built from the header's own menus so the two cannot drift apart, with the
 * pages that only the footer lists added in place. Pricing is a page of its own in the header, so it is added
 * to Product here. The menus' small links (the live record, the changelog, GitHub, status, the AI files) are
 * gathered under Resources. Every page here is one to be written; the ones with no address show as Soon.
 */
const [overview, ...moreProduct] = menu("Product")?.main ?? [];
const [docs, ...moreDevelopers] = menu("Developers")?.main ?? [];

export const SITEMAP: Column[] = [
	{
		title: "Product",
		items: once(
			[
				...(overview ? [overview] : []),
				{ label: "How It Works", href: "/how-it-works" },
				{ label: "Machines", href: "/machines" },
				...moreProduct,
				{ label: "Pricing", href: "/pricing" },
			],
			taken,
		),
	},
	{
		title: "Developers",
		items: once(
			[
				...(docs ? [docs] : []),
				{ label: "Quickstart", href: DOCS_PAGES.quickstart },
				...moreDevelopers,
				{ label: "Examples", href: DOCS_PAGES.examples },
			],
			taken,
		),
	},
	{
		title: "Resources",
		items: once(
			[
				{ label: "Papers", href: "/papers" },
				...(menu("Product")?.aside ?? []),
				...(menu("Developers")?.aside ?? []),
			],
			taken,
		),
	},
	{
		title: "Company",
		items: once(
			[
				...(menu("Company")?.main ?? []),
				{ label: "Support", href: "/support" },
				{ label: "Brand Assets", href: "/brand" },
				...(menu("Company")?.aside ?? []),
			],
			taken,
		),
	},
	{
		title: "Legal",
		items: once(
			[
				{ label: "Terms", href: "/terms" },
				{ label: "Privacy", href: "/privacy" },
				{ label: "Risk Disclosure", href: "/risk" },
				{ label: "Acceptable Use", href: "/acceptable-use" },
				{ label: "License", href: "/license" },
				{ label: "Security Disclosure", href: "/disclosure" },
				{ label: "Preferences", action: "preferences" },
			],
			taken,
		),
	},
];
