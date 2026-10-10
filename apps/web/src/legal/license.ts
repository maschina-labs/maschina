import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's license page. There is no open source license: the code is public so it can be read and reviewed, and all
 * rights in it are reserved, which is what this page says and nothing more. It tells a reader what reading allows, what
 * it does not, how to ask for more, and that third party parts and the fonts are under their own terms. It matches the
 * repository's own notice. When a license is chosen (the decision was put off on purpose), this page is where it goes.
 * It has not yet been reviewed by a lawyer.
 */
export const LICENSE: LegalDoc = {
	title: "License",
	updated: "October 9, 2026",
	intro: [
		"Maschina's source code is public so that it can be read and checked. It is source-available, which is not the same as open source. This page says what that means for you.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full license below is what counts.",
				{
					list: [
						"You may read the code, and look at how Maschina works.",
						"We have not given anyone a license to use, copy, change, share or sell the code. All rights are reserved by Maschina Labs.",
						"It is not open source. There is no open source license on it.",
						"If you want to do more than read it, ask us, and wait for a yes in writing.",
					],
				},
			],
		},
		{
			heading: "What this is",
			body: [
				"The source code of Maschina is published in a public repository so that people can read it, review it and see for themselves how Maschina handles money. Publishing it is not the same as licensing it. We keep every right in it, and Maschina Labs is the owner of the code that we wrote.",
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
						"View and fork the repository on GitHub, to the extent that GitHub's own terms of service allow that. That permission comes from GitHub's terms and not from us, and it covers GitHub only.",
					],
				},
			],
		},
		{
			heading: "What you may not do",
			body: [
				"Without our written permission, you may not:",
				{
					list: [
						"Use the code, or run it, for any purpose beyond reading and review.",
						"Copy the code, or parts of it, into your own work.",
						"Change the code, or make something based on it.",
						"Share, publish or host the code, or a copy of it, anywhere else.",
						"Sell, rent or sublicense the code, or offer a service built on it.",
						"Remove or hide any notice in it, or say that it is yours.",
					],
				},
			],
		},
		{
			heading: "Asking for permission",
			body: [
				[
					"If you want to do something this page does not allow, write to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					" and tell us what you would like to do and why. A permission counts only if it is in writing and comes from us. Silence is not permission, and a permission for one thing is not permission for anything else.",
				],
			],
		},
		{
			heading: "Contributions",
			body: [
				"We are not accepting outside contributions to the code for now. A contribution can be taken only under a license, and none has been chosen. If that changes, we will say here how contributions will be licensed, before we accept any.",
			],
		},
		{
			heading: "Third party code and fonts",
			body: [
				"Maschina is built with code written by other people. Each of those parts stays under its own license, which is not changed by this page, and which gives you the rights it says it gives you for that part.",
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
				"We may choose a license for some or all of the code later, for example for a toolkit that we want developers to build on. If we do, we will publish it here, with the date, and it will apply from that date. It will not take back anything that this page already allows.",
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
