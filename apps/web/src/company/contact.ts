import type { ArticleDoc } from "../article.tsx";

/**
 * The contact page: which address to write to for which kind of message, so a message reaches the right person the
 * first time. Only role addresses appear, never a person's. It promises no reply time, since there is no support
 * team yet to hold one to.
 */
export const CONTACT: ArticleDoc = {
	kicker: "Company",
	title: "Contact Maschina Labs.",
	standfirst:
		"Write to the address that fits your message, and it reaches the right place the first time.",
	byline: "Maschina Labs",
	date: "October 9, 2026",
	sections: [
		{
			heading: "Support",
			body: [
				[
					"Help using Maschina, a machine that is not behaving as you expect, or a question about how something works: ",
					{ text: "support@maschina.dev", href: "mailto:support@maschina.dev" },
					". Please say which machine, and what you expected to happen.",
				],
			],
		},
		{
			heading: "Billing",
			body: [
				[
					"Questions about a charge, a fee or an invoice: ",
					{ text: "billing@maschina.dev", href: "mailto:billing@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "Security",
			body: [
				[
					"A security problem should be reported privately, never in a public post. The ",
					{ text: "security disclosure", href: "/disclosure" },
					" page says how, and what to expect. The address is ",
					{ text: "security@maschina.dev", href: "mailto:security@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "Legal",
			body: [
				[
					"Questions about the terms, the privacy policy or the license, and requests for permission: ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "Reporting abuse",
			body: [
				[
					"Something that breaks the acceptable use policy: ",
					{ text: "abuse@maschina.dev", href: "mailto:abuse@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "Elsewhere",
			body: [
				[
					"The work is public on ",
					{ text: "GitHub", href: "https://github.com/maschina-labs/maschina" },
					", and short updates go out on ",
					{ text: "X", href: "https://x.com/maschinalabs" },
					". Maschina Labs is based in Alberta, Canada.",
				],
			],
		},
	],
};
