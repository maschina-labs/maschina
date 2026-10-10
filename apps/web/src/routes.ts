/**
 * The pages there are, each by its address and its name: every page the header, the menus, the search and the footer
 * link to. Every one is blank for now: the header and the footer with a screen of nothing between them, to be filled
 * in one at a time. The docs, the live record, the status page and the two AI files have a blank page here too until
 * each is moved or replaced by what it is to be (its own app, a status page run by someone else, a plain file). Sign
 * in and sign up are a separate app and are never pages here.
 */
export const ROUTES: Record<string, string> = {
	"/product": "Product",
	"/marketplace": "Marketplace",
	"/network": "Network",
	"/mobile": "Mobile",
	"/docs": "Docs",
	"/live": "Live record",
	"/status": "Status",
	"/llms.txt": "AI index",
	"/SKILL.md": "Skill file",
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
