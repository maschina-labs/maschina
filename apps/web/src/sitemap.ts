/**
 * Every page Maschina will have, grouped the way the footer shows them. The footer is the map of the whole
 * site, built or not, so it keeps the work aligned. Each leads to # until its page is built.
 */
type Link = { label: string; href: string };

const soon = (label: string): Link => ({ label, href: "#" });

export const COLUMNS: { name: string; links: Link[] }[] = [
	{
		name: "Product",
		links: [
			"Overview",
			"Security",
			"Live record",
			"Marketplace",
			"Network",
			"Mobile",
			"Pricing",
			"Changelog",
		].map(soon),
	},
	{
		name: "Build",
		links: ["Docs", "API", "SDK", "Machine spec", "Templates", "GitHub", "Status"].map(soon),
	},
	{
		name: "Company",
		links: ["About", "Roadmap", "News", "Newsletter", "Brand", "Contact"].map(soon),
	},
	// For the software reading the site rather than the people: Maschina is built for machines that handle
	// money, so they get their own way in. The index and full text are llms.txt and llms-full.txt, the skill
	// file is a SKILL.md, and the MCP server lets an AI drive Maschina under the owner's rules.
	{
		name: "Machines",
		links: ["AI index", "Full text", "Skill file", "MCP server", "Public records", "Registry"].map(
			soon,
		),
	},
];

/** The legal pages sit on the copyright line rather than in a column of their own. */
export const LEGAL: Link[] = ["Terms", "Privacy", "Risk", "Security", "License"].map(soon);
