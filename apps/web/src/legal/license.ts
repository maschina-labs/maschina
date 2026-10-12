import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's license page. The code is public so it can be read and reviewed, and it is released under the Functional
 * Source License, Version 1.1, with an Apache 2.0 future license (FSL-1.1-Apache-2.0): anyone may run, change and share
 * it for any purpose except a competing one, and each version becomes available under Apache 2.0 two years after it is
 * published. It is source-available, not open source, and this page says so. It matches the repository's own LICENSE file,
 * which is the text that counts. It has not yet been reviewed by a lawyer.
 */
export const LICENSE: LegalDoc = {
	title: "License",
	updated: "October 11, 2026",
	intro: [
		"Maschina's source code is public so that it can be read and checked. It is source-available, which is not the same as open source. It is released under the Functional Source License, and this page says what that means for you.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full license below is what counts.",
				{
					list: [
						"You may read the code, and look at how Maschina works.",
						"You may run it, change it and build on it for any purpose except a competing one, which includes your own use, learning and research.",
						"You may not sell it, or offer a product or service that does what Maschina does. Anyone who shares a copy must keep our copyright notices and this license with it.",
						"Each version also becomes available under the Apache 2.0 license two years after we publish it.",
					],
				},
			],
		},
		{
			heading: "What this is",
			body: [
				"The source code of Maschina is published in a public repository so that people can read it, review it and see for themselves how Maschina handles money. It is licensed under the Functional Source License, Version 1.1, with an Apache 2.0 future license (FSL-1.1-Apache-2.0). The full text is the LICENSE file in the repository, and that text is what counts. Maschina Labs is the owner of the code that we wrote.",
			],
		},
		{
			heading: "What you may do",
			body: [
				{
					list: [
						"Read the code, and study how it works.",
						"Review it, for example to check a claim we make, and tell us about what you find.",
						"Talk about it, and quote short parts of it to explain or criticize it.",
						"Run it, change it and share it for any purpose that is not a competing use, such as your own use, learning, research, or professional services for someone who uses it under this license. When you share it, include the license and keep our copyright notices.",
					],
				},
			],
		},
		{
			heading: "What you may not do",
			body: [
				"Under this license, you may not:",
				{
					list: [
						"Use the code to make something that competes with Maschina: a product or service that does the same or nearly the same things, or replaces something we offer.",
						"Offer the code to others as a commercial product or service of that kind, hosted or sold.",
						"Remove or hide a copyright notice or this license from any copy.",
						"Say that the code is yours, or that we approve your product.",
						"Use the Maschina name, logos or design as your own. See the names and logos below.",
						"Use it in a way that breaks the law or another person's rights.",
					],
				},
			],
		},
		{
			heading: "Asking for permission",
			body: [
				[
					"If you want to do something this license does not allow, such as offer a competing service, write to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					" and tell us what you would like to do and why. A permission beyond this license counts only if it is in writing and comes from us.",
				],
			],
		},
		{
			heading: "Contributions",
			body: [
				"We are not accepting outside contributions to the code for now. Before we do, we will put a contributor agreement in place so that every contribution can be licensed the same way as the rest. We will say here when that changes.",
			],
		},
		{
			heading: "Third party code and fonts",
			body: [
				"Maschina is built with code written by other people. Each of those parts stays under its own license, which is not changed by this page, and which gives you the rights it says it gives you for that part. Their notices are in the THIRD-PARTY-NOTICES file in the repository.",
				"The typeface Söhne, which this website and the app use, is licensed to us and is not part of the code. It is not in the repository, and nothing here gives you any right to it.",
			],
		},
		{
			heading: "Names and logos",
			body: [
				[
					"The Maschina name and logo, and the design of the site and the app, belong to us. Nothing on this page gives you any right to use them, except to refer to Maschina fairly and accurately. See the ",
					{ text: "brand assets", href: "/brand" },
					" for how they may be used.",
				],
			],
		},
		{
			heading: "No warranty",
			body: [
				[
					"The code is provided as it is, with no promise that it works, that it is safe or that it is fit for any purpose. What is said in the ",
					{ text: "terms of service", href: "/terms" },
					" about warranties and liability applies here too.",
				],
			],
		},
		{
			heading: "This may change",
			body: [
				"We may release later versions under a different license, for example a more open one. If we do, we will publish it here, with the date. A version already released under this license stays available under it, and nothing here is taken back.",
			],
		},
		{
			heading: "Contact",
			body: [
				[
					"Questions about this license, or requests for permission, can go to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
	],
};
