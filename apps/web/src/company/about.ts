import type { ArticleDoc } from "../article.tsx";

/**
 * The About page. It says what Maschina is, why it exists and where it stands, in the company's own serious voice, and
 * it claims nothing that is not true today: no users, no audit, no returns. The code is public, so the page points to
 * it.
 */
export const ABOUT: ArticleDoc = {
	kicker: "Company",
	title: "Controls for AI that holds money.",
	standfirst:
		"Maschina is infrastructure for machines that act with real money on Solana, inside limits their owner sets and checks they cannot bypass.",
	byline: "Maschina Labs",
	date: "October 9, 2026",
	sections: [
		{
			body: [
				"An AI that can only produce text is easy to oversee. An AI that can spend is not. Once it holds money, each mistake has a cost, and each claim about its behavior needs a way to be verified.",
				"Maschina is built around that problem. A machine is an AI with its own wallet and a defined job. Its owner sets what it may do and how much it may spend. Before anything is signed, Maschina checks the action against those rules, and an action that fails the check does not happen.",
				{ quote: "The AI decides. Maschina decides what it is allowed to do." },
			],
		},
		{
			heading: "Why it exists",
			body: [
				"Automated trading on chain already exists, and so does AI that can operate a wallet. What is missing is a dependable boundary between the two: a limit the AI cannot argue its way past, and a record of every decision that the owner can read afterward.",
				"Maschina Labs began building that boundary on September 16, 2026. The first machine runs for its founder. Others follow once it has earned the trust to carry them.",
			],
		},
		{
			heading: "How it works",
			body: [
				{
					list: [
						"Each machine has its own wallet, and its limits are set before it starts.",
						"A separate signer is the only component that can request a signature, and only after the rules pass.",
						"Every decision, including those that were refused, is written to a permanent record.",
						"A machine can run on paper first, with no real money, so its behavior can be observed before it is funded.",
					],
				},
				[
					"What can go wrong is set out in full in the ",
					{ text: "risk disclosure", href: "/risk" },
					" and the ",
					{ text: "terms", href: "/terms" },
					".",
				],
			],
		},
		{
			heading: "Where it stands",
			body: [
				"Maschina is early. It is developed in the open: the source code is public. It is source-available, not open source, and it has not been independently audited.",
				"Maschina Labs does not publish figures it cannot support. When a machine's results are worth showing, they will come from a public record that anyone can check.",
			],
		},
		{
			heading: "The company",
			body: [
				[
					"Maschina is built by Maschina Labs, founded by Asher Wilson in Alberta, Canada. The work is public on ",
					{ text: "GitHub", href: "https://github.com/maschina-labs/maschina" },
					". To reach the company, use the ",
					{ text: "contact page", href: "/contact" },
					".",
				],
			],
		},
	],
};
