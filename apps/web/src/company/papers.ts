/**
 * The papers page: a place for each video, deck and paper Maschina Labs means to publish. Each place says what it will
 * be. A place with no address says Coming soon and is not a link, so there is no dead link; the moment it has an
 * address, it becomes a link. It promises no date and states no figure.
 */
type PaperItem = { name: string; body: string; href?: string };

export type PapersDoc = {
	kicker: string;
	title: string;
	standfirst: string;
	groups: { heading: string; items: PaperItem[] }[];
};

export const PAPERS: PapersDoc = {
	kicker: "Resources",
	title: "Papers",
	standfirst:
		"Videos, decks and papers about Maschina, collected in one place as each one is ready.",
	groups: [
		{
			heading: "Videos",
			items: [
				{
					name: "Demo video",
					body: "A walk through the app: making a machine, setting its limits and watching what it decides.",
				},
				{
					name: "Pitch video",
					body: "What Maschina is, the problem it solves, and where it is going.",
				},
			],
		},
		{
			heading: "Decks",
			items: [
				{
					name: "Pitch deck",
					body: "The short version of the story, as slides.",
				},
				{
					name: "Investor deck",
					body: "The longer version, for people considering backing Maschina Labs.",
				},
			],
		},
		{
			heading: "Papers",
			items: [
				{
					name: "Whitepaper",
					body: "The thesis: why an AI that holds money needs limits it cannot change.",
				},
				{
					name: "Technical paper",
					body: "How machines, the signer and the permanent record fit together.",
				},
				{
					name: "Security model",
					body: "What each part is trusted with, what it is not, and what can still go wrong.",
				},
			],
		},
	],
};
