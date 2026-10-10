import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's acceptable use policy: what may not be done with Maschina or with a machine, and what happens if it is.
 * It is the list the terms of service point to, written for a product where software spends money by itself, so it
 * speaks to what a machine does as much as to what a person does. It promises no watching it cannot do. It has not yet
 * been reviewed by a lawyer.
 */
export const ACCEPTABLE_USE: LegalDoc = {
	title: "Acceptable Use Policy",
	updated: "October 9, 2026",
	intro: [
		[
			"This policy says what you may not do with Maschina, and what we may do if it happens. It is part of our ",
			{ text: "terms of service", href: "/terms" },
			", and the same words mean the same thing here. It applies to what you do, and to what any machine you create does, because a machine acts on your behalf.",
		],
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full policy below is what counts.",
				{
					list: [
						"Do not use Maschina, or a machine, to break the law, to evade sanctions, or to move money that is not yours.",
						"Do not use a machine to manipulate a market, to scam people, or to attack a person, a protocol or Maschina.",
						"Do not get around the limits, the checks or the security of the service.",
						"You are responsible for what your machines do.",
						"If you break these rules we may pause your machines or end your access, and we may tell the authorities.",
					],
				},
			],
		},
		{
			heading: "Why this exists",
			body: [
				"Maschina, run by Maschina Labs, lets software spend money on its own, around the clock, from its own wallet. That is useful, and it also means the rules about what is and is not allowed matter more than they do for most services. These rules protect the people who use Maschina, the people and protocols a machine could affect, and the service itself.",
			],
		},
		{
			heading: "Illegal activity",
			body: [
				"You may not use Maschina, or let a machine be used, to:",
				{
					list: [
						"Break any law or rule that applies to you or to us.",
						"Evade sanctions, or deal with a person, place or wallet that is under sanctions.",
						"Launder money, or hide where money came from.",
						"Pay for, or raise money for, terrorism or any crime.",
						"Move money that you do not own or are not allowed to use, including stolen funds.",
						"Commit fraud, theft or extortion.",
					],
				},
			],
		},
		{
			heading: "Markets and trading conduct",
			body: [
				"You may not use a machine to deceive a market or the people in it. This includes:",
				{
					list: [
						"Wash trading: trading with yourself to make a token look busier than it is.",
						"Spoofing and layering: placing orders you mean to cancel to push a price.",
						"Pump and dump schemes, or coordinating machines to move a price so that someone can sell into it.",
						"Trading on information that you are not allowed to use, such as confidential information from inside a project.",
						"Creating, promoting or selling a token that is designed to take people's money, including a rug pull.",
					],
				},
				"Ordinary trading, including trading that is fast, frequent or automated, is allowed. These rules are about deception and harm, not about trading well.",
			],
		},
		{
			heading: "What a machine must not do",
			body: [
				"A machine must not be built or set up to:",
				{
					list: [
						"Take money from a wallet or a protocol it has no right to, including by exploiting a flaw in a contract.",
						"Phish, impersonate or trick people into sending it money.",
						"Spam the network with transactions, or flood a service with requests.",
						"Spend money that is not its owner's.",
						"Hide what it is doing from the record, or work around the record.",
						"Do anything else in this policy.",
					],
				},
			],
		},
		{
			heading: "The service and its security",
			body: [
				"You may not attack, overload or probe Maschina. In particular, you may not:",
				{
					list: [
						"Get around, switch off or test the limits, the signer checks, the rate limits or any other protection, except as described in the security disclosure.",
						"Look for, read or use another person's information or funds.",
						"Run a denial of service attack, or send more requests than a fair user would.",
						"Scrape or copy the service in ways the license does not allow.",
						"Put malware, or anything harmful, into the service or into a machine.",
						"Reverse engineer the service, except where the license or the law allows it.",
					],
				},
				[
					"If you find a security problem, please tell us through the ",
					{ text: "security disclosure", href: "/disclosure" },
					" page, and do not use it to get at anyone's money or information.",
				],
			],
		},
		{
			heading: "Accounts and identity",
			body: [
				"Use only wallets that you control. Do not pretend to be someone else, or use someone else's wallet or account without their permission. Do not make new accounts or wallets to get around a limit or a ban that we have put on you.",
			],
		},
		{
			heading: "The manager and what machines say",
			body: [
				"Do not use the manager, or any machine that uses an AI model, to produce anything illegal, harmful, hateful or deceptive, to harass anyone, or to get around the rules of the AI provider whose key you are using. Names, descriptions and anything else you put into Maschina must not be false, abusive or infringing, and must not misstate what a machine has done or can do.",
			],
		},
		{
			heading: "Other people's rights",
			body: [
				"Do not use Maschina to infringe someone else's copyright, trademark or other rights, or to collect people's personal information without their consent.",
			],
		},
		{
			heading: "Other services' rules",
			body: [
				"Maschina works with other services, such as the wallet provider, the Solana network, swap and price services, and AI providers. Each has its own rules. You may not use Maschina to break them.",
			],
		},
		{
			heading: "What we may do",
			body: [
				"We are not required to watch what you do, and we may not see a breach of this policy. If we do find or suspect one, we may, without notice where the situation calls for it:",
				{
					list: [
						"Ask you to stop, and ask you to explain.",
						"Pause or stop one machine, or all of yours.",
						"Limit or end your access to the service.",
						"Remove or hide something you put into Maschina.",
						"Keep records, and tell the authorities or the people affected, and help them.",
					],
				},
				"If we pause your machines or end your access, you should still be able to withdraw your funds to your own wallet, unless the law, an order from the authorities or a technical failure prevents it.",
			],
		},
		{
			heading: "Reporting abuse",
			body: [
				[
					"If you see something that breaks this policy, tell us at ",
					{ text: "abuse@maschina.dev", href: "mailto:abuse@maschina.dev" },
					". Please include what you saw and where, and any wallet addresses or links. For a security problem, use the ",
					{ text: "security disclosure", href: "/disclosure" },
					" page instead.",
				],
			],
		},
		{
			heading: "Changes to this policy",
			body: [
				"We may change this policy. When we do, we will change the date at the top of this page, and if the change is a big one we will also tell you in the app or on the website. A change applies from the date it is posted.",
			],
		},
		{
			heading: "Contact",
			body: [
				[
					"Questions about this policy can go to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					". Reports of abuse go to ",
					{ text: "abuse@maschina.dev", href: "mailto:abuse@maschina.dev" },
					".",
				],
			],
		},
	],
};
