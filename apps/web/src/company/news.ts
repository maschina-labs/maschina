import type { ArticleDoc } from "../article.tsx";

/**
 * The news page. There is nothing to announce yet, and the page says so rather than inventing a story: no partners,
 * no funding, no numbers. It points to where news will appear first, and to the roadmap. When there is a first real
 * announcement it goes here, newest first, in sections under this one.
 */
export const NEWS: ArticleDoc = {
	kicker: "Company",
	title: "News from Maschina Labs.",
	standfirst:
		"Announcements about the product and the company, when there is something true to say.",
	byline: "Maschina Labs",
	date: "October 9, 2026",
	sections: [
		{
			body: [
				"There is nothing to announce yet. Maschina is early and is being built in the open, and we would rather say nothing than announce what is not real.",
				"When there is news, it will be posted here first, newest at the top, with its date.",
			],
		},
		{
			heading: "Follow along",
			body: [
				{
					list: [
						"The work itself is public: every change is on GitHub.",
						"Short updates go out on X as they happen.",
						"What we are working on, and in what order, is on the roadmap.",
					],
				},
				[
					"Find us on ",
					{ text: "X", href: "https://x.com/maschinalabs" },
					" and on ",
					{ text: "GitHub", href: "https://github.com/maschina-labs/maschina" },
					", or read the ",
					{ text: "roadmap", href: "/roadmap" },
					".",
				],
			],
		},
	],
};
