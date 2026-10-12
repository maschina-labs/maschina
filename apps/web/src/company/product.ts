import type { ArticleDoc } from "../article.tsx";

/**
 * The Product pages: what Maschina is, how a machine works, what a machine can do and how it is kept inside its limits.
 * They read like the company pages, in the company's voice, and claim only what is built today: no returns, no figures,
 * no audit. The security page says what is not built yet as plainly as what is.
 */

export const PRODUCT: ArticleDoc = {
	kicker: "Product",
	title: "One place to run machines.",
	standfirst:
		"Maschina is the app where you make a machine, fund it, watch what it does and take the money back.",
	byline: "Maschina Labs",
	date: "October 11, 2026",
	sections: [
		{
			body: [
				"A machine is software with its own Solana wallet, a budget it cannot overspend and a job to do. You choose the job and set the limits. The machine does that job and nothing else, and it writes down everything it did.",
				{ quote: "The AI decides. Maschina decides what it is allowed to do." },
			],
		},
		{
			heading: "What you can do today",
			body: [
				{
					list: [
						"Make a machine, from a kind that works today, and give it a wallet of its own.",
						"Try it on paper first: real prices, no real money.",
						"Fund it, start it, pause it, resume it or stop it.",
						"See your machines, what each one decided and why, and what it earned or lost.",
						"Take the money back out to your own wallet.",
						"Ask a manager about your machines, using your own AI key.",
					],
				},
			],
		},
		{
			heading: "Built on Solana",
			body: [
				"Every trade settles on Solana, where anyone can check it. A wallet is how you sign in today, and a machine's budget, rules and record sit beside it in Maschina.",
			],
		},
		{
			heading: "Where it stands",
			body: [
				"Maschina is early. The first machine has traded the founder's own money on Solana since September 28, 2026, and every one of its trades can be checked on the chain. The code is public: it is source-available, not open source, and it has not been independently audited.",
				[
					"Read how a machine works in ",
					{ text: "how it works", href: "/how-it-works" },
					", what a machine can do in ",
					{ text: "machines", href: "/machines" },
					" and how it is kept inside its limits in ",
					{ text: "security", href: "/security" },
					". What can go wrong is in the ",
					{ text: "risk disclosure", href: "/risk" },
					".",
				],
			],
		},
	],
};

export const HOW_IT_WORKS: ArticleDoc = {
	kicker: "Product",
	title: "How a machine works.",
	standfirst:
		"A machine has a wallet, a budget and a job. Everything it does is checked before it moves and written down after.",
	byline: "Maschina Labs",
	date: "October 11, 2026",
	sections: [
		{
			heading: "Pick a kind, set its limits",
			body: [
				"You choose what the machine does, such as buying SOL on a schedule or trading inside a price band. It gets a wallet of its own. You set how much it may spend and which tokens it may touch. Those limits are yours, and the machine cannot change them.",
			],
		},
		{
			heading: "Try it on paper first",
			body: [
				"A machine can run on paper. It is quoted the real price, checked against an independent one, and its trade is recorded as if it had happened, with the budget moving exactly as it would with money. Nothing is built and nothing is signed, so no real money is at risk.",
			],
		},
		{
			heading: "Checked before it moves",
			body: [
				{
					list: [
						"The machine proposes a trade.",
						"The rules check it against your limits, and the budget is reserved.",
						"A separate signer, the only part that can request a signature, signs it, and only if the checks pass.",
						"Solana settles it, and the budget is settled at the real cost read back from the chain.",
					],
				},
				"A trade that fails a check does not happen.",
			],
		},
		{
			heading: "Written down",
			body: [
				"Every decision goes into an append-only record, including the ones that were refused and the reason. Each trade that does happen settles on Solana, so it can be checked there without trusting Maschina.",
			],
		},
		{
			heading: "You stay in control",
			body: [
				"You can pause, resume or stop a machine at any time, and take its money back to your own wallet. A stop switch at the signer can pause every machine at once, and it does not block a withdrawal.",
			],
		},
		{
			heading: "What this does not promise",
			body: [
				[
					"A machine can lose money, and Maschina does not promise a result. It is early and has not been independently audited. Read the ",
					{ text: "risk disclosure", href: "/risk" },
					" before putting money in.",
				],
			],
		},
	],
};

export const MACHINES: ArticleDoc = {
	kicker: "Product",
	title: "What a machine can do.",
	standfirst:
		"Three kinds work today. More are planned, and each is tried on paper before it is trusted with money.",
	byline: "Maschina Labs",
	date: "October 11, 2026",
	sections: [
		{
			heading: "Working today",
			body: [
				{
					list: [
						"Recurring buy: buys a set amount on a schedule.",
						"Price trigger: acts once when the price crosses a level you choose.",
						"Range: buys at the low edge of a price band and sells at the high edge, then repeats, holding one position at a time. A following range moves its band with the price.",
					],
				},
			],
		},
		{
			heading: "Limits you set",
			body: [
				"Every machine has a budget, and the machine cannot go over it. A range machine also has its band, a floor, an amount per trade and a daily limit. A range narrower than the cost of two swaps is refused, because it would lose on every round trip.",
			],
		},
		{
			heading: "Machines that decide with an AI",
			body: [
				"A paper trader decides with an AI, against live prices, with no real money. It shows how an AI behaves inside the same limits before anything is trusted to it.",
			],
		},
		{
			heading: "Planned",
			body: [
				"Planned next are a grid, a rebalancer, a trailing stop that sells in steps as the price rises, and a machine that puts idle money to work. They are planned, not built, and each will be tried on paper first.",
			],
		},
		{
			heading: "Before you rely on one",
			body: [
				[
					"Read ",
					{ text: "how a machine works", href: "/how-it-works" },
					" and the ",
					{ text: "risk disclosure", href: "/risk" },
					". A machine can lose money.",
				],
			],
		},
	],
};

export const SECURITY: ArticleDoc = {
	kicker: "Product",
	title: "How a machine is kept inside its limits.",
	standfirst:
		"Safety comes before strategy. Each layer below is built and can be read in the code, and what is not built yet is said plainly.",
	byline: "Maschina Labs",
	date: "October 11, 2026",
	sections: [
		{
			heading: "The layers",
			body: [
				{
					list: [
						"A budget held in a ledger the machine cannot edit.",
						"Rules checked before anything is signed.",
						"A signer that is the only part able to request a signature, and that sends each transaction exactly once.",
						"A wallet policy, enforced by the wallet provider, on every machine's wallet.",
						"A permanent record of every decision, including the ones that were refused.",
						"A stop switch at the signer that can pause every machine at once.",
					],
				},
				"No single layer is trusted on its own. A trade has to get through each of them.",
			],
		},
		{
			heading: "Keys",
			body: [
				"The keys for a machine's wallet are held by the wallet provider, not by Maschina's application code. Maschina never holds your own wallet's keys, and it cannot recover them if you lose them.",
			],
		},
		{
			heading: "What is still being built",
			body: [
				"Maschina is early and has not been independently audited. Limits on how much of a book one position may take, a cap on an owner's total loss, and moving more of the protection beyond Maschina's own servers are still being built. Until they are, do not put in money you cannot afford to lose.",
			],
		},
		{
			heading: "Reading the code",
			body: [
				[
					"The code is public on ",
					{ text: "GitHub", href: "https://github.com/maschina-labs/maschina" },
					". It is source-available, not open source.",
				],
			],
		},
		{
			heading: "Reporting a problem",
			body: [
				[
					"If you find a security problem, report it privately through the ",
					{ text: "security disclosure", href: "/disclosure" },
					" and test only with your own accounts and funds.",
				],
			],
		},
	],
};
