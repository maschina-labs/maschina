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
	"/live": "Live Record",
	"/security": "Security",
	"/how-it-works": "How It Works",
	"/machines": "Machines",
	"/pricing": "Pricing",
	"/papers": "Papers",
	"/company": "Company",
	"/about": "About",
	"/roadmap": "Roadmap",
	"/contact": "Contact",
	"/support": "Support",
	"/brand": "Brand Assets",
	"/terms": "Terms",
	"/privacy": "Privacy",
	"/risk": "Risk Disclosure",
	"/acceptable-use": "Acceptable Use",
	"/license": "License",
	"/disclosure": "Security Disclosure",
};

/**
 * The plain files the site serves as they are, from public/. They are endpoints of this site, not pages and not
 * other sites: an agent or a crawler reads them, and the header and the footer link to a few, with no arrow. Each one is a real file, and a test checks that it exists.
 */
export const FILES: Record<string, string> = {
	"/llms.txt": "AI Index",
	"/llms-full.txt": "Full text",
	"/SKILL.md": "Skill File",
	"/robots.txt": "Robots",
	"/sitemap.xml": "Sitemap",
	"/humans.txt": "Humans",
};

/** Whether a link leaves the site: it goes to another address. The plain files in FILES are endpoints of this site. */
export function leavesSite(href: string): boolean {
	return href.startsWith("https://");
}

/** The name of the page at an address, with or without a trailing slash; nothing for an address with no page. */
export function titleFor(path: string): string | undefined {
	const clean = path.replace(/\/+$/, "") || "/";
	return ROUTES[clean];
}
