import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's security disclosure page: how to report a vulnerability, what is in and out of scope, how to test without
 * harming anyone, and what to expect back. It follows the repository's own security file (private reporting through
 * GitHub, a reply within three days, the same list of what matters most, only the latest release supported) and adds the
 * rules and the good faith promise a researcher needs. It offers no reward, because there is no bounty, and it promises
 * no fix date it cannot keep. It has not yet been reviewed by a lawyer.
 */
export const DISCLOSURE: LegalDoc = {
	title: "Security Disclosure",
	updated: "October 9, 2026",
	intro: [
		"Maschina controls wallets and moves money, so Maschina Labs takes reports of security problems seriously and answers them quickly. If you have found one, this page tells you how to tell us, what we care about most, and how to test without hurting anyone.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full page below is what counts.",
				{
					list: [
						"Report a security problem privately, never in a public issue or a post.",
						"We will reply within three days.",
						"Test only with your own accounts and your own funds, and stop as soon as you have proved the problem.",
						"If you follow these rules, we will treat your research as authorized and will not take legal action against you.",
						"We do not run a bug bounty yet, so we cannot pay for reports. We can credit you if you want.",
					],
				},
			],
		},
		{
			heading: "How to report",
			body: [
				"Please report privately, by either of these:",
				{
					list: [
						"Through GitHub's private vulnerability reporting, which is the way we prefer.",
						"By email to security@maschina.dev.",
					],
				},
				[
					"The GitHub report goes ",
					{
						text: "here",
						href: "https://github.com/maschina-labs/maschina/security/advisories/new",
					},
					". Please do not open a public issue, and do not tell anyone else before we have had the chance to fix it.",
				],
				[
					"Email goes to ",
					{ text: "security@maschina.dev", href: "mailto:security@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "What to include",
			body: [
				"The more you tell us, the faster we can fix it. Please include:",
				{
					list: [
						"What you found, and where.",
						"How to reproduce it, step by step.",
						"What an attacker could do with it, and what it would affect.",
						"Any proof, such as a transaction, a screenshot or a short script, kept to the least that shows the problem.",
						"How you would like to be named, or that you would rather not be.",
					],
				},
			],
		},
		{
			heading: "What happens next",
			body: [
				"We will reply within three days to say we have your report. We will look into it and keep you up to date, and we will tell you when it is fixed. We cannot promise how long a fix will take, because it depends on the problem, but we will tell you what we know as we know it.",
				"If you want, we will name you when we say that it was fixed. If you would rather not be named, we will not name you.",
			],
		},
		{
			heading: "What matters most",
			body: [
				"Everything in the Maschina repository, and the services we run from it, is in scope. These are the problems that matter most to us:",
				{
					list: [
						"Any way for a machine to move funds anywhere its owner's rules do not allow.",
						"Any way to go beyond a machine's budget or its limits.",
						"Any way to act as another user or another machine.",
						"Any way to read or change the permanent record of what a machine did.",
						"Any secret or key that could leave the service that holds it.",
					],
				},
			],
		},
		{
			heading: "What is out of scope",
			body: [
				"These are not security problems for the purpose of this page:",
				{
					list: [
						"Attacks on our people or our users by trickery, such as phishing or pretending to be someone.",
						"Attacks on a building, a device or a person.",
						"Denial of service, and tests that flood the service with traffic.",
						"Problems in a service we use but do not run, such as the Solana network or the wallet provider. Please report those to the people who run them.",
						"Reports from an automated scanner with no proof that it is a real problem.",
						"A missing setting or header that has no effect you can show.",
						"Problems in a version that is not the latest release. Only the latest release is supported.",
						"The AI giving a wrong or odd answer, unless you can show it leads to a problem in the list above.",
					],
				},
			],
		},
		{
			heading: "How to test safely",
			body: [
				"Please follow these rules while you look:",
				{
					list: [
						"Use only your own accounts, your own wallets and your own funds, and use as little money as you can.",
						"Do not look at, take, change or delete anyone else's information or funds. If you reach someone else's information by accident, stop, tell us, and do not keep it.",
						"Do not run anything that slows or stops the service for others.",
						"Do not try to trick our people or our users.",
						"Do not stop, pause or change a machine that is not yours.",
						"Keep what you find to yourself until we have fixed it.",
					],
				},
			],
		},
		{
			heading: "Our promise to you",
			body: [
				"If you follow the rules on this page, we will treat your research as authorized, we will not take legal action against you for it, and we will not ask the authorities to. If someone else begins legal action against you for research that followed these rules, we will say that it was authorized.",
				"This promise covers what is ours. It cannot cover the services we use, which have their own rules, and it does not make something lawful that the law forbids.",
			],
		},
		{
			heading: "Rewards",
			body: [
				"We do not run a bug bounty program yet, so we cannot pay for reports. We are grateful for them, and we will credit you if you want to be credited. If we begin a program, we will say so here.",
			],
		},
		{
			heading: "Supported versions",
			body: [
				"Only the latest release is supported. If you found a problem in an older one, please check whether it is still there in the latest before you report it.",
			],
		},
		{
			heading: "Contact",
			body: [
				[
					"Security reports go to ",
					{ text: "security@maschina.dev", href: "mailto:security@maschina.dev" },
					". Questions about this page can go to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
	],
};
