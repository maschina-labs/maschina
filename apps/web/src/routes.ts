/**
 * The pages there are, each by its address and its name. Every one is blank for now: the header and the footer with
 * nothing between them, to be filled in one at a time. Left out on purpose: the docs (their own app), the live record
 * (to be a separate app), the status page (run by someone else), the two AI files (plain files, not pages), and sign
 * in and sign up, which are a separate app and are never pages here.
 */
export const ROUTES: Record<string, string> = {
	"/product": "Product",
	"/security": "Security",
	"/how-it-works": "How it works",
	"/machines": "Machines",
	"/pricing": "Pricing",
	"/changelog": "Changelog",
	"/papers": "Papers",
	"/developers": "Developers",
	"/api": "API",
	"/sdk": "SDK",
	"/spec": "Machine spec",
	"/quickstart": "Quickstart",
	"/templates": "Templates",
	"/examples": "Examples",
	"/mcp": "MCP server",
	"/company": "Company",
	"/about": "About",
	"/roadmap": "Roadmap",
	"/news": "News",
	"/contact": "Contact",
	"/careers": "Careers",
	"/support": "Support",
	"/brand": "Brand assets",
	"/terms": "Terms",
	"/privacy": "Privacy",
	"/risk": "Risk disclosure",
	"/acceptable-use": "Acceptable use",
	"/license": "License",
	"/disclosure": "Security disclosure",
};

/** The name of the page at an address, with or without a trailing slash; nothing for an address with no page. */
export function titleFor(path: string): string | undefined {
	const clean = path.replace(/\/+$/, "") || "/";
	return ROUTES[clean];
}
