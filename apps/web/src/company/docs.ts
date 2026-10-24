import type { ArticleDoc } from "../article.tsx";

/**
 * The Quickstart, on the site rather than in a separate docs app, because a page that exists beats a
 * subdomain that does not. It teaches exactly one thing end to end: how a person who has never heard
 * of Maschina gets a machine running on paper and watches what it does.
 *
 * Everything on it is true today. Paper is open and real money is not, a wallet is the only way in,
 * and no claim is made about what a machine earns. A step that does not work yet is not written here
 * at all, because a quickstart that fails halfway is worse than a shorter one.
 */
export const DOCS: ArticleDoc = {
	kicker: "Docs",
	title: "Run your first machine.",
	standfirst:
		"A machine is software with its own wallet, a job, and limits it cannot change. This gets one running on paper, against live prices, with nothing at risk.",
	byline: "Maschina Labs",
	date: "October 18, 2026",
	sections: [
		{
			body: [
				"Paper is open to anyone. Real money is not open yet, and the app says so when it is asked. A machine on paper reads the same live prices, makes the same decisions and is held to the same limits as one that trades for real. The only difference is that nothing is signed and nothing is spent.",
				{ quote: "Nothing here spends money. A machine on paper signs nothing at all." },
			],
		},
		{
			heading: "What you need",
			body: [
				"A compatible Solana wallet of your choice. Signing in asks for a message signature to prove that you control the wallet. It does not transfer funds or approve spending.",
				"No money. A machine on paper is given a budget as a number, not as funds.",
			],
		},
		{
			heading: "1. Sign in",
			body: [
				"Open the app and choose Connect. The wallet shows one message to sign. Signing it proves the account is yours and nothing else: it moves nothing, approves nothing and costs no fee.",
				"Signing in with a wallet is the only way in at the moment. Email is being built.",
			],
		},
		{
			heading: "2. Make a machine",
			body: [
				"Choose New machine. Paper is on by default, and leaving it on is the whole point of this page.",
				"Pick what the machine does. Four kinds exist today:",
				{
					list: [
						"Fixed range: buys below a price you set and sells above it.",
						"Following range: the same, with the band moving as the market does.",
						"Price trigger: acts once, when a price is reached.",
						"Recurring buy: buys a set amount on a schedule.",
					],
				},
				"Then set its limits. These are the numbers the machine cannot argue with: how much it may spend in one trade, how much in a day, and which tokens it may touch at all. An empty list of tokens approves none of them, not all of them.",
			],
		},
		{
			heading: "3. Start it, and watch",
			body: [
				"A new machine does nothing until it is started. Once it is, it checks prices on its schedule and decides whether to act.",
				"Decisions show in the app as they happen, the refused ones included. A refusal is not a failure: it is the limits working, and it is written down with the rule that stopped it.",
			],
		},
		{
			heading: "What the limits actually do",
			body: [
				"The part worth understanding, because it is the difference between this and a script with an API key.",
				{
					list: [
						"The limits live in a record the machine cannot edit, not in its own settings.",
						"Every action is checked against them before anything is signed, by a separate component that does nothing else.",
						"The check is made on what a transaction really does, worked out by simulating it, not on what the machine says it will do.",
						"An action that fails the check does not happen, and the refusal is written down.",
					],
				},
				"On paper none of that is theatre. The same checks run, and the same refusals are recorded. What changes with real money is only that a signature follows a check that passed.",
			],
		},
		{
			heading: "Where the record is",
			body: [
				"Every finished trade of every machine on the public record is at maschina.dev/live, real money and paper in separate tables that are never added together, each real trade linking to its transaction on chain.",
				"A machine's record is private unless its owner chooses otherwise. The ones on that page are the founder's own.",
				"The record is what the application reports. It is not, by itself, proof that the controls behind it hold. Maschina is early and has not had an independent security audit.",
			],
		},
		{
			heading: "What is not here yet",
			body: [
				"Said plainly, so nothing on this page is a surprise later.",
				{
					list: [
						"Real money is not open. Paper machines only, for now.",
						"There is no API or SDK to write against yet.",
						"Email sign-in is being built. A wallet is the only way in.",
						"Nothing has been independently audited.",
					],
				},
				"Something broken or unclear goes to support@maschina.dev, and the Feedback screen in the app fills that in for you.",
			],
		},
	],
};
