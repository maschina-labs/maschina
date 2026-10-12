import { DOCS } from "../links.ts";
/**
 * The support page: the ways to get help, as cards that lead to real pages, and an empty state for the help articles,
 * which do not exist yet. It promises no reply time and no hours, because there is no support team to hold to them.
 */
export type SupportDoc = {
	kicker: string;
	title: string;
	standfirst: string;
	ways: { title: string; body: string; href: string }[];
	articles: { heading: string; body: string };
	/**
	 * The help center: the search box's words, the topics that sort the real pages of the site, and the heading over the
	 * other ways. Last on purpose, so nothing written before it moves in the translations.
	 */
	center: {
		search: string;
		none: string;
		topics: { title: string; body: string; pages: string[] }[];
		moreWays: string;
	};
};

export const SUPPORT: SupportDoc = {
	kicker: "Company",
	title: "Support",
	standfirst: "Help using Maschina, and where to look first.",
	ways: [
		{
			title: "Write to support",
			body: "Something is not working, or you cannot tell how it should. Send a message and say which machine.",
			href: "/contact",
		},
		{
			title: "Read the docs",
			body: "How machines, limits and the signer work, and how to build on Maschina.",
			href: DOCS,
		},
		{
			title: "Know the risks",
			body: "What can go wrong with a machine and its money, said plainly.",
			href: "/risk",
		},
		{
			title: "Report a security problem",
			body: "Found a way around a limit, or a leak? Report it privately.",
			href: "/disclosure",
		},
	],
	articles: {
		heading: "No help articles yet.",
		body: "Guides for getting started and for common problems will be listed here as they are written.",
	},
	center: {
		search: "Search for help",
		none: "No help pages match that. Write to support and say what you were looking for.",
		topics: [
			{
				title: "Getting started",
				body: "What Maschina is, and how a machine works.",
				pages: ["/product", "/how-it-works", "/machines"],
			},
			{
				title: "Safety and risk",
				body: "How a machine is kept inside its limits, and what can go wrong.",
				pages: ["/security", "/risk", "/acceptable-use"],
			},
			{
				title: "Terms and privacy",
				body: "The rules for using Maschina, and what is kept about you.",
				pages: ["/terms", "/privacy", "/license"],
			},
			{
				title: "About Maschina",
				body: "Who builds it, where it is going, and how to write about it.",
				pages: ["/about", "/roadmap", "/brand", "/papers"],
			},
		],
		moreWays: "Other ways to get help",
	},
};
