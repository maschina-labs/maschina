import { MENUS } from "./menus.ts";

/** One page the search can take you to: its name, its address, and which menu it lives in. */
export type Hit = { label: string; href: string; section: string };

/** The pages that are not in a dropdown. */
const LOOSE: Hit[] = [
	{ label: "Papers", href: "/papers", section: "Site" },
	{ label: "Pricing", href: "/pricing", section: "Site" },
];

/**
 * Every page there is somewhere to go, once each, in the order of the menus. What is not built yet has no
 * address, so it is left out: a search result that goes nowhere is worse than none.
 */
function indexPages(): Hit[] {
	const seen = new Set<string>();
	const hits: Hit[] = [];
	const add = (hit: Hit) => {
		if (seen.has(hit.href)) return;
		seen.add(hit.href);
		hits.push(hit);
	};
	for (const [section, menu] of Object.entries(MENUS)) {
		for (const item of [...menu.main, ...menu.aside]) {
			if (item.href) add({ label: item.label, href: item.href, section });
		}
	}
	for (const hit of LOOSE) add(hit);
	return hits;
}

export const PAGES_INDEX: Hit[] = indexPages();

/** The pages whose name or menu contains what was typed, in English or in the reader's own language. Nothing typed gives them all. */
export function search(query: string, translate: (name: string) => string = (name) => name): Hit[] {
	const words = query.trim().toLowerCase();
	if (!words) return PAGES_INDEX;
	return PAGES_INDEX.filter(
		(hit) =>
			hit.label.toLowerCase().includes(words) ||
			hit.section.toLowerCase().includes(words) ||
			translate(hit.label).toLowerCase().includes(words) ||
			translate(hit.section).toLowerCase().includes(words),
	);
}
