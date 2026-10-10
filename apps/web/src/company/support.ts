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
			href: "/docs",
		},
		{
			title: "Check the status",
			body: "Whether Maschina is up, and whether machines are paused.",
			href: "https://status.maschina.dev",
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
};
