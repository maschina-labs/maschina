/**
 * What each dropdown holds. The big links on the left are the pages; the small ones beside them are the
 * way on. A link with no address is not built yet: it shows dimmed and tagged Soon, and is never a link.
 */
import { DOCS, DOCS_PAGES, LIVE, STATUS } from "./links.ts";

type Item = { label: string; href?: string };

export type Menu = {
	/** The small gray line above the big links. */
	intro: string;
	main: Item[];
	/** The small gray line above the small links. */
	asideTitle: string;
	aside: Item[];
};

const ORG = "https://github.com/maschina-labs";
const CHANGELOG = "https://github.com/maschina-labs/maschina/blob/main/CHANGELOG.md";
const X = "https://x.com/maschinalabs";

export const MENUS: Record<string, Menu> = {
	Product: {
		intro: "Explore Maschina",
		main: [
			{ label: "Overview", href: "/product" },
			{ label: "Security", href: "/security" },
			{ label: "Marketplace" },
			{ label: "Network" },
			{ label: "Mobile" },
		],
		asideTitle: "See It Work",
		aside: [
			{ label: "Live Record", href: LIVE },
			{ label: "Changelog", href: CHANGELOG },
		],
	},
	Developers: {
		intro: "Build on Maschina",
		main: [
			{ label: "Docs", href: DOCS },
			{ label: "API", href: DOCS_PAGES.api },
			{ label: "SDK", href: DOCS_PAGES.sdk },
			{ label: "Machine Spec", href: DOCS_PAGES.spec },
			{ label: "Templates", href: DOCS_PAGES.templates },
		],
		asideTitle: "For Builders and Agents",
		aside: [
			{ label: "GitHub", href: ORG },
			{ label: "Status", href: STATUS },
			{ label: "AI Index", href: "/llms.txt" },
			{ label: "Skill File", href: "/SKILL.md" },
			{ label: "MCP Server" },
		],
	},
	Company: {
		intro: "The Company",
		main: [
			{ label: "About", href: "/about" },
			{ label: "Roadmap", href: "/roadmap" },
			{ label: "Changelog", href: CHANGELOG },
			{ label: "Contact", href: "/contact" },
		],
		asideTitle: "Follow",
		aside: [
			{ label: "X", href: X },
			{ label: "GitHub", href: ORG },
		],
	},
};
