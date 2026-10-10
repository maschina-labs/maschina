import type { ArticleDoc } from "../article.tsx";

/**
 * The roadmap: what Maschina is working on, what comes after, and what is further off, in three plain groups with no
 * dates. It claims nothing that is not true today and promises no outcome, because a date or a promise on a public page
 * becomes a debt. What is listed comes from the private plan, and only what can be said openly.
 */
export const ROADMAP: ArticleDoc = {
	kicker: "Company",
	title: "What Maschina is building, in the order it is building it.",
	standfirst:
		"Three groups: what is underway, what comes next, and what is further off. There are no dates, because a date on a page is a promise.",
	byline: "Maschina Labs",
	date: "October 9, 2026",
	sections: [
		{
			body: [
				"This page is a statement of direction, not a commitment. Plans change as we learn, and an item moving from one group to another, or leaving the list, is normal. What is here is the order we believe is right today.",
			],
		},
		{
			heading: "Now",
			body: [
				"The work underway.",
				{
					list: [
						"The front pages of this site, and the documents that go with them.",
						"Risk limits at the signer: a position's share of the book, and drawdown.",
						"Paper machines that run on live prices with no real money.",
						"Sign in on its own address, with more ways to sign in than a wallet.",
						"The public record of what a machine decided, including what it refused.",
					],
				},
			],
		},
		{
			heading: "Next",
			body: [
				"What follows once those are in place.",
				{
					list: [
						"A stop switch for every machine, and loss caps across all of an owner's machines.",
						"Reconciliation: checking what a machine's record says against what is on chain.",
						"A tested way to withdraw everything, written down and rehearsed.",
						"Alerts to the owner by message when a machine does something that matters.",
						"A developer interface for proposing a trade to a machine's rules.",
						"Documentation on its own address.",
					],
				},
			],
		},
		{
			heading: "Later",
			body: [
				"Ideas we intend to pursue, with less certainty about how and when.",
				{
					list: [
						"Machine rules held on chain, after an independent audit.",
						"A way to publish a proven machine, and for others to copy it.",
						"Machines that run on other people's computers, with those people paid for it.",
						"A phone app.",
					],
				},
			],
		},
		{
			heading: "What is not on the list",
			body: [
				[
					"Maschina is early, and it has not been independently audited. No date is set for an audit, and we will not set one until we can keep it. What can go wrong is set out in the ",
					{ text: "risk disclosure", href: "/risk" },
					", and what has changed lately is in the ",
					{ text: "changelog", href: "/changelog" },
					".",
				],
			],
		},
	],
};
