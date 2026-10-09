import { MENUS } from "./menus.ts";

type Entry = { label: string; href?: string };

/** One column of the footer's sitemap. A link with no address is not built yet, and shows as Soon. */
export type Column = { title: string; items: Entry[] };

/**
 * Takes an address once: the first column to list a page keeps it, so a page never appears twice. The pages
 * not built yet go last, in the order they were given, so a column reads built pages first.
 */
function once(items: Entry[], taken: Set<string>): Entry[] {
	const fresh = items.filter((item) => {
		if (!item.href) return true;
		if (taken.has(item.href)) return false;
		taken.add(item.href);
		return true;
	});
	return [...fresh.filter((item) => item.href), ...fresh.filter((item) => !item.href)];
}

const taken = new Set<string>();
const menu = (name: string) => MENUS[name];

/**
 * The footer's map of the site, built from the header's own menus so the two cannot drift apart. Pricing is a
 * page of its own in the header, so it is added to Product here. Legal is new: the pages every launch needs.
 */
export const SITEMAP: Column[] = [
	{
		title: "Product",
		items: once(
			[
				...(menu("Product")?.main ?? []),
				{ label: "Pricing", href: "/pricing" },
				...(menu("Product")?.aside ?? []),
			],
			taken,
		),
	},
	{
		title: "Developers",
		items: once([...(menu("Developers")?.main ?? []), ...(menu("Developers")?.aside ?? [])], taken),
	},
	{
		title: "Company",
		items: once([...(menu("Company")?.main ?? []), ...(menu("Company")?.aside ?? [])], taken),
	},
	{
		title: "Legal",
		items: once(
			[
				{ label: "Terms", href: "/terms" },
				{ label: "Privacy", href: "/privacy" },
			],
			taken,
		),
	},
];
