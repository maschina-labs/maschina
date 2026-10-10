/**
 * The pages there are, each by its address and its name: every page the header, the menus, the search and the footer
 * link to. The ones with nothing on them yet are blank: the header and the footer with a screen of nothing between
 * them, to be filled in one at a time. The docs and the live record have a blank page here until each is moved or
 * replaced by what it is to be (its own app). The status page is run by someone else and the AI files are plain files,
 * so neither is a page here (see FILES). Sign in and sign up are a separate app and are never pages here.
 */
export const ROUTES: Record<string, string> = {
	"/product": "Product",
	"/marketplace": "Marketplace",
	"/network": "Network",
	"/mobile": "Mobile",
	"/docs": "Docs",
	"/live": "Live record",
	"/security": "Security",
	"/how-it-works": "How it works",
	"/machines": "Machines",
	"/pricing": "Pricing",
	"/papers": "Papers",
	"/developers": "Developers",
	"/api": "API",
	"/sdk": "SDK",
	"/spec": "Machine spec",
	"/quickstart": "Quickstart",
	"/templates": "Templates",
	"/examples": "Examples",
	"/company": "Company",
	"/about": "About",
	"/roadmap": "Roadmap",
	"/contact": "Contact",
	"/support": "Support",
	"/brand": "Brand assets",
	"/terms": "Terms",
	"/privacy": "Privacy",
	"/risk": "Risk disclosure",
	"/acceptable-use": "Acceptable use",
	"/license": "License",
	"/disclosure": "Security disclosure",
};

/**
 * The plain files the site serves as they are, from public/. They are not pages: an agent or a crawler reads them, and
 * the header and the footer link to a few. Each one is a real file, and a test checks that it exists.
 */
export const FILES: Record<string, string> = {
	"/llms.txt": "AI index",
	"/llms-full.txt": "Full text",
	"/SKILL.md": "Skill file",
	"/robots.txt": "Robots",
	"/sitemap.xml": "Sitemap",
	"/humans.txt": "Humans",
};

/** The name of the page at an address, with or without a trailing slash; nothing for an address with no page. */
export function titleFor(path: string): string | undefined {
	const clean = path.replace(/\/+$/, "") || "/";
	return ROUTES[clean];
}
