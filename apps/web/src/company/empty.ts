/**
 * The pages that have nothing on them yet, and say so plainly instead of inventing something. Each is a head and one
 * empty state: a line saying there is nothing, a sentence on what to do meanwhile, and where to look. When there is a
 * real announcement or a real role, the page becomes a list and this goes.
 */
export type EmptyDoc = {
	kicker: string;
	title: string;
	standfirst: string;
	/** The empty state's own line, such as "Nothing to announce yet." */
	heading: string;
	body: string;
	links: { label: string; href: string }[];
};

export const NEWS: EmptyDoc = {
	kicker: "Company",
	title: "News",
	standfirst:
		"Announcements about the product and the company, when there is something true to say.",
	heading: "Nothing to announce yet.",
	body: "Maschina is early and is being built in the open. When there is news, it will be posted here first, newest at the top, with its date.",
	links: [
		{ label: "X", href: "https://x.com/maschinalabs" },
		{ label: "GitHub", href: "https://github.com/maschina-labs/maschina" },
		{ label: "Roadmap", href: "/roadmap" },
	],
};

export const CAREERS: EmptyDoc = {
	kicker: "Company",
	title: "Careers",
	standfirst: "Roles at Maschina Labs, when there are any.",
	heading: "No open roles right now.",
	body: "Maschina Labs is not hiring at the moment. If that changes, the roles will be listed here with what each one involves.",
	links: [
		{ label: "Contact", href: "/contact" },
		{ label: "GitHub", href: "https://github.com/maschina-labs/maschina" },
	],
};
