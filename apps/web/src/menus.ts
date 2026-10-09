/**
 * What each dropdown holds. The big links on the left are the pages; the small ones beside them are the
 * way on. A link with no address is not built yet: it shows dimmed and tagged Soon, and is never a link.
 */
export type Item = { label: string; href?: string };

export type Menu = {
	/** The small gray line above the big links. */
	intro: string;
	main: Item[];
	/** The small gray line above the small links. */
	asideTitle: string;
	aside: Item[];
};

const REPO = "https://github.com/maschina-labs/maschina";
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
		asideTitle: "See it work",
		aside: [
			{ label: "Live record", href: "/live" },
			{ label: "Changelog", href: "/changelog" },
		],
	},
	Developers: {
		intro: "Build on Maschina",
		main: [
			{ label: "Docs", href: "/docs" },
			{ label: "API", href: "/api" },
			{ label: "SDK", href: "/sdk" },
			{ label: "Machine spec", href: "/spec" },
			{ label: "Templates", href: "/templates" },
		],
		asideTitle: "For builders and agents",
		aside: [
			{ label: "GitHub", href: REPO },
			{ label: "Status", href: "/status" },
			{ label: "AI index", href: "/llms.txt" },
			{ label: "Skill file", href: "/SKILL.md" },
			{ label: "MCP server", href: "/mcp" },
		],
	},
	Company: {
		intro: "The company",
		main: [
			{ label: "About", href: "/about" },
			{ label: "Roadmap", href: "/roadmap" },
			{ label: "Changelog", href: "/changelog" },
			{ label: "News", href: "/news" },
			{ label: "Contact", href: "/contact" },
		],
		asideTitle: "Follow",
		aside: [
			{ label: "X", href: X },
			{ label: "GitHub", href: REPO },
		],
	},
};
