/**
 * The papers page: a place for each video, deck and paper Maschina Labs means to publish. Each place says what it will
 * be. A place with no address says Coming soon and is not a link, so there is no dead link; the moment it has an
 * address, it becomes a link. It promises no date and states no figure.
 */
type PaperItem = {
	name: string;
	/** The number shown above the name, for the papers that are numbered. */
	number?: string;
	/** What it is, in a line. Left out where the name says it. */
	body?: string;
	href?: string;
};

export type PapersDoc = {
	kicker: string;
	title: string;
	standfirst: string;
	/**
	 * Where the one download of everything on the page is: every video's script, deck and paper, and the figures used in
	 * them. Left out until the file exists, so the button is shown but is not a link, and there is no dead link.
	 */
	pack?: string;
	groups: {
		id: string;
		heading: string;
		/** Smaller cards, three across, for a long list. */
		compact?: boolean;
		items: PaperItem[];
	}[];
};

/** The fourteen papers, in their order. The index comes before them, as 00. */
const PAPER_NAMES = [
	"Primer",
	"Whitepaper",
	"Protocol and Architecture",
	"Security and Custody",
	"The Machine",
	"The Surface",
	"The Network",
	"The Machine Economy",
	"Integrity",
	"Economics",
	"The Path",
	"Using Maschina",
	"Building on Maschina",
	"Risk and Disclosures",
];

export const PAPERS: PapersDoc = {
	kicker: "Resources",
	title: "Papers",
	standfirst:
		"Videos, decks and papers about Maschina, collected in one place as each one is ready.",
	groups: [
		{
			id: "videos",
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
			id: "decks",
			heading: "Decks",
			items: [
				{ name: "Pitch deck", body: "The short version of the story, as slides." },
				{
					name: "Investor deck",
					body: "The longer version, for people considering backing Maschina Labs.",
				},
			],
		},
		{
			id: "papers",
			heading: "The papers",
			compact: true,
			items: [
				{ name: "Index", number: "00" },
				...PAPER_NAMES.map((name, index) => ({
					name,
					number: String(index + 1).padStart(2, "0"),
				})),
			],
		},
	],
};
