import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's privacy policy: what is collected, why, who else sees it, how long it is kept, and what a person can ask
 * for. It is written from what the product actually does today (sign in with a wallet, an email, Google, GitHub or single sign-on, machines and
 * their permanent record, secrets stored sealed, no third party ads, and analytics only if you allow it) and says plainly where the design
 * limits what can be deleted: a record that cannot be rewritten, and a chain that cannot be erased. It has not yet been
 * reviewed by a lawyer.
 */
export const PRIVACY: LegalDoc = {
	title: "Privacy Policy",
	updated: "October 9, 2026",
	intro: [
		"This policy explains what information Maschina collects, why, who else sees it, how long it is kept, and what you can ask us to do with it. Maschina is built to need as little about you as possible: you can sign in with nothing but a Solana wallet, and we do not ask for a phone number or a government ID.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full policy below is what counts.",
				{
					list: [
						"You can sign in with a Solana wallet, with an email and password, with Google or GitHub, or through your organization's single sign-on. We store the address or account you sign in with. We never store a password as you typed it, only a one way hash of it.",
						"We keep your machines' settings and a permanent record of what each machine does. That record is built so it cannot be rewritten, which limits what can be deleted.",
						"Transactions on the Solana network are public and permanent. We cannot erase them and neither can you.",
						"If you give us a key for an AI provider, we store it encrypted, and we use it only to run your own manager and machines.",
						"If you accept optional cookies, we use PostHog to see how Maschina is used. If you do not, we do not.",
						"We do not sell your information, and we do not show third party ads in Maschina.",
						"You can ask to see, correct or delete your information, within the limits above, by writing to us.",
					],
				},
			],
		},
		{
			heading: "Who we are",
			body: [
				"Maschina is run by Maschina Labs. In this policy, we, us and our mean Maschina Labs. We are responsible for the information described here.",
				[
					"This policy goes with our ",
					{ text: "terms of service", href: "/terms" },
					". Words that are explained there, such as machine and service, mean the same thing here.",
				],
			],
		},
		{
			heading: "What we collect",
			body: [
				"We collect only what the service needs. It falls into these groups:",
				{
					list: [
						"Your account: the way you sign in. That is the address of your wallet, or your email address and a one way hash of your password, or the identifier Google or GitHub gives us for your account together with the name and picture they pass on if you allow it, or the identity your organization's single sign-on sends us. We also keep a record that a sign in happened. A wallet address is public on the Solana network already.",
						"Your machines: each machine's name, kind, settings, limits and wallet address, and the permanent record of what it does, including its decisions, its trades, the ones that were refused and the reasons.",
						"Secrets you give us: a key for an AI provider, if you choose to give one, and a link to a Telegram chat, if you set up alerts. We store them sealed, meaning encrypted with a key that is kept apart from the database, and show you only a hint of them. Passwords are different: we never store one, only a one way hash from which it cannot be worked out.",
						"Your conversations with the manager: what you ask it and what it answers. They are sent to the AI provider whose key you gave us, and may be kept with your account so you can read them again.",
						"Technical information: your IP address, the type of browser and device, the pages and requests made and when, and error reports. We use it to keep the service running and secure.",
						"How Maschina is used: which pages and screens you open, what you click, and your device, browser and approximate location from your IP address. This is collected by PostHog, our analytics service, only if you accept optional cookies.",
						"What you send us: if you write to us, we keep the message and your address so we can answer.",
					],
				},
			],
		},
		{
			heading: "What we do not collect",
			body: [
				"We do not have the private keys of your own wallet, and we cannot see your recovery phrase. We do not ask for a phone number to use Maschina, and we do not ask for a government ID. If the law or a feature ever requires us to verify who you are, we will say so here first and ask only for that feature. We do not collect payment card details: where a fee is charged, it is described when it applies.",
			],
		},
		{
			heading: "How we use it",
			body: [
				"We use your information to:",
				{
					list: [
						"Provide the service: sign you in, create and run your machines, check each trade against your limits, and show you what happened.",
						"Send the alerts you asked for.",
						"Keep the service safe: limit abuse, find and fix errors, and protect users and their funds.",
						"Understand how Maschina is used, and improve it, with the analytics you allowed.",
						"Answer you when you write to us.",
						"Meet our legal duties, and enforce our terms.",
					],
				},
				"We do not use your information to make decisions about you that carry legal effect, and we do not build profiles of you for advertising. We may advertise Maschina on other services. When we do, we do not pass them your Maschina information, and we do not sell it. If we ever add advertising trackers to Maschina itself, we will ask you first and change this policy before we do.",
			],
		},
		{
			heading: "The permanent record and the public chain",
			body: [
				"Two things in Maschina cannot be changed afterwards, by design, and you should know about them before you use it.",
				"The first is a machine's record. Everything a machine does is written to a record once and never changed, so that what a machine did can always be checked. For this reason we cannot delete or edit a machine's record, even if you ask. We can stop using it, and we can remove it from your view.",
				"The second is the Solana network. Transactions your machines make are public and permanent, and they show the wallet addresses involved. Neither we nor anyone else can remove them.",
			],
		},
		{
			heading: "Cookies",
			body: [
				"Maschina uses three kinds of cookie.",
				{
					list: [
						"The sign in cookie keeps you signed in. Scripts on the page cannot read it. It is essential, so it is always on while you are signed in.",
						"The preferences cookie holds your choice about optional cookies, so we do not ask you again. It is the only cookie that records a choice.",
						"Analytics cookies, set by PostHog, which tell us how Maschina is used. They are optional: they are set only if you accept optional cookies, and not otherwise.",
					],
				},
				"You can change your choice at any time with the Preferences link at the bottom of every page. You can also block or delete cookies in your browser, but if you block the sign in cookie you will not be able to sign in.",
			],
		},
		{
			heading: "Who else sees your information",
			body: [
				"We share information only with the services that help us run Maschina, and only what each needs. They include:",
				{
					list: [
						"Hosting and network services, such as Cloudflare, which carry requests to and from the site and the API.",
						"Sign in providers: Google or GitHub, if you sign in with them, and your organization's identity provider, if you use single sign-on. They tell us who you are, and they learn that you signed in to Maschina.",
						"PostHog, our analytics service, which receives how Maschina is used, if you accept optional cookies.",
						"The wallet provider that holds the keys of your machines' wallets, which receives what it needs to create a wallet and to sign a transaction we ask it to.",
						"Node, price and swap services that we ask for prices, quotes and transactions on the Solana network.",
						"The AI provider whose key you give us, such as Anthropic, which receives the questions and the market and machine details sent to it to get an answer.",
						"Telegram, if you set up alerts, which delivers them.",
						"Email and error reporting services we use to send sign in and account emails, to answer you and to find faults.",
					],
				},
				"We may also share information if the law requires it, to protect people from harm, or as part of a sale or merger of Maschina, in which case we will tell you if your information is handed to someone else. We do not sell your information.",
			],
		},
		{
			heading: "AI providers",
			body: [
				"When you use the manager, or a machine that asks an AI model what to do, the question and the details it needs are sent to the AI provider whose key you gave us. That provider has its own terms and its own privacy policy, and it is your account with them, not ours. Please read them. We do not send your key to anyone but that provider.",
			],
		},
		{
			heading: "Where it is processed",
			body: [
				"Maschina is run from Canada, and the services we use run in Canada, the United States and other countries. Your information may be processed in any of those places, where the laws on privacy may differ from the laws where you live. We choose providers that commit to protecting information, and we send only what each needs.",
			],
		},
		{
			heading: "How long we keep it",
			body: [
				"We keep your account information while you use Maschina, and for a reasonable time after, so you can come back and so we can meet our legal duties. We keep technical logs and error reports for a short time and then delete them. Secrets you gave us are deleted when you remove them or close your account.",
				"The permanent record of a machine, and anything on the Solana network, stay as described above. Backups are kept for a limited time and are then deleted.",
			],
		},
		{
			heading: "How we protect it",
			body: [
				"Secrets are stored sealed, the sign in cookie cannot be read by scripts on the page, and access to our systems is limited to the people and services that need it. No system is perfectly secure, and we cannot promise that information will never be lost, stolen or seen by someone who should not. If we find that something that affects you has happened, we will tell you as the law requires.",
				[
					"If you find a security problem, please tell us through the ",
					{ text: "security disclosure", href: "/disclosure" },
					" page.",
				],
			],
		},
		{
			heading: "Your choices and rights",
			body: [
				"You can ask us to show you the information we hold about you, to correct it, to delete it, to stop using it for something, or to give you a copy. We will answer within thirty days. We may need you to prove who you are. If you sign in with a wallet, we will ask you to sign a message with it. If you sign in with an email, Google, GitHub or single sign-on, we will send a message to that address or ask you to sign in again.",
				"We can delete your account information, your secrets and your alert settings. We cannot delete a machine's permanent record or anything on the Solana network, for the reasons above. Some information we may have to keep to meet the law or to settle a dispute.",
				"If you live somewhere the law gives you more rights, such as in the European Union, the United Kingdom or California, we respect them. You may also complain to the privacy regulator where you live.",
				[
					"To make a request, write to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
		{
			heading: "Children",
			body: [
				"Maschina is not for anyone under 18, and we do not knowingly collect information from anyone under 18. If you think a child has given us information, tell us and we will delete it.",
			],
		},
		{
			heading: "Changes to this policy",
			body: [
				"We may change this policy. When we do, we will change the date at the top of this page, and if the change is a big one, such as using your information in a new way, we will also tell you in the app or on the website before it starts. If we begin to use analytics or any advertising, we will say so here first.",
			],
		},
		{
			heading: "Contact",
			body: [
				[
					"Questions about this policy, or requests about your information, can go to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
	],
};
