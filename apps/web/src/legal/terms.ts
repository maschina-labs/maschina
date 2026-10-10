import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's terms of service, written to be read: plain sentences, defined words used the same way every time, and
 * no promise that cannot be kept. It is a good faith draft of how the product works today (machines with their own
 * wallets, limits checked before anything is signed, paper machines, an AI that may be wrong, the code readable but
 * not open source) and it has not yet been reviewed by a lawyer. The governing law is Alberta, where its author
 * lives, until a company is set up and a lawyer says otherwise.
 */
export const TERMS: LegalDoc = {
	title: "Terms of Service",
	updated: "October 9, 2026",
	intro: [
		"These terms are the agreement between you and Maschina Labs about your use of Maschina. Please read them. By using Maschina you agree to them. If you do not agree, please do not use it.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary so you know what you are getting into. The full terms below are what count, and where this summary and the full terms differ, the full terms win.",
				{
					list: [
						"Maschina lets you create machines: software that trades or does other work for you from its own wallet, inside limits you set.",
						"You can lose some or all of the money you put into a machine. Nothing here is financial advice and nothing is guaranteed.",
						"You decide what a machine does and how much it can spend. You are responsible for what it does with that.",
						"A machine can be made on paper first, with no real money, so you can watch it work before you trust it.",
						"Maschina is early software. It can break, change or stop, and parts of it have not been independently reviewed.",
						"The source code is readable, but it is source-available, which is different from open source.",
					],
				},
			],
		},
		{
			heading: "Who we are and what Maschina is",
			body: [
				"Maschina is run by Maschina Labs. In these terms, we, us and our mean Maschina Labs, and you means the person using Maschina.",
				"Maschina is software for giving an AI a wallet and a job. It includes this website, the Maschina app, our programming interfaces, the machines you create, the signer that decides what a machine is allowed to do, and any other product or service we offer under the Maschina name. We call all of it the service.",
				"A machine is a program with its own wallet on the Solana network. It has a purpose, a budget and a set of limits that you choose. Before a machine can spend anything, the signer checks the transaction against those limits. A machine that fails the check cannot spend.",
			],
		},
		{
			heading: "Who can use Maschina",
			body: [
				"You can use Maschina only if all of these are true:",
				{
					list: [
						"You are at least 18 years old, and you are old enough to make a binding agreement where you live.",
						"You are not barred from using the service by any law that applies to you, and you are not on any list of sanctioned or restricted people or places.",
						"You have not been told to stop using Maschina by us.",
					],
				},
				"Some places have laws about crypto assets, trading tools or automated trading. You are responsible for knowing the laws that apply to you and for following them. We may limit or block access to the service from some places, and we may do so without notice.",
			],
		},
		{
			heading: "Your wallet and signing in",
			body: [
				"You sign in to Maschina with a Solana wallet, and your wallet address is how we know who you are. We do not hold your wallet's private keys and we cannot recover them if you lose them. Keep your wallet and your recovery phrase safe. Anyone who controls your wallet can act as you in Maschina.",
				"You are responsible for everything done through your account, including by anyone you let use your wallet. Tell us quickly if you think someone else has got into it.",
			],
		},
		{
			heading: "Machines, wallets and money",
			body: [
				"Each machine has its own wallet. The keys to that wallet are held by a third party wallet provider, not by the machine and not by Maschina's own software. Our signer can ask the provider to sign a transaction, but only after the transaction passes the machine's rules.",
				"You choose how much to give a machine and what it may do. You can set limits such as a budget, a most per trade, a most per day and the tokens it may use. A machine's wallet is set up so that it can only pay out to you, its owner. You can ask to withdraw what is in a machine's wallet back to your own wallet at any time, subject to the next paragraph.",
				"Withdrawals and trades depend on the Solana network, your wallet provider and other services. They can be slow, can fail, or can be held up while machines are paused. A transaction that has been confirmed on the network usually cannot be reversed, by you or by us.",
				"The limits you set are there to keep a machine inside a boundary. They do not make it safe. A machine that does exactly what you allowed can still lose money, for example because a price moves against it, a trade fills at a worse price than quoted, or a token stops being worth anything.",
				"You are responsible for the funds you put into a machine, for the settings you choose, and for any taxes that apply to what a machine does. We do not give tax advice and we do not report your trades for you.",
			],
		},
		{
			heading: "Paper machines",
			body: [
				"A paper machine makes pretend trades against live prices, with no real money. It is a way to watch a machine work before you give it money. Paper results are not real results. Real trades cost fees and can fill at worse prices than a paper trade shows, so a machine that does well on paper may do worse with real money.",
			],
		},
		{
			heading: "The AI and automation",
			body: [
				"Some machines, and the manager you can talk to in the app, use an AI model to decide what to do or to answer you. An AI model can be wrong, can misread a situation, and can act on bad or out of date information. Its decisions are made by a program, not by a person, and no person checks them as they happen.",
				"If you give Maschina a key for an AI provider, we use it only to run your own manager and machines, and you pay that provider yourself. Keep your own spending limit set with the provider.",
				"You are responsible for the jobs you give a machine and for the limits you put around it. Do not give a machine more money than you can afford to lose.",
			],
		},
		{
			heading: "No financial advice, and the risks",
			body: [
				"Maschina is software. It is not a broker, an exchange, a bank or an investment adviser, and it does not give financial, investment, legal or tax advice. Nothing in the service, in what a machine does, or in anything we say is a recommendation to buy or sell anything. This is not financial advice.",
				"You can lose some or all of the money you put into a machine. Crypto assets are volatile and can lose all of their value. Other risks include the following:",
				{
					list: [
						"Prices can move fast, and a machine can buy or sell at a price you did not expect.",
						"Software, including ours, can have bugs, and a bug can cause a loss.",
						"The Solana network, wallet providers, price sources and other services can fail, slow down or change.",
						"Tokens can be scams, can be hard to sell, or can be taken apart by their creators.",
						"Laws and rules about crypto assets can change, and a change can affect what you can do.",
						"Past results, on paper or with real money, do not predict future results.",
					],
				},
				[
					"Any numbers, charts or screenshots we show may use sample data and are only there to show how the product looks. We do not promise any result. The ",
					{ text: "risk disclosure", href: "/risk" },
					" says more about these risks, and you should read it before you use real money.",
				],
			],
		},
		{
			heading: "Fees",
			body: [
				"Some parts of the service may be free and some may carry fees. If a fee applies to something you use, we will show it to you before you use it, and the pricing page will say what it is. You are not charged a fee you have not been shown.",
				"Network fees, wallet provider fees, AI provider fees and the cost of a trade itself are separate from our fees. They are paid to the people who provide those things, they are not under our control, and you pay them.",
			],
		},
		{
			heading: "Third-party services",
			body: [
				"Maschina relies on services we do not run, including the Solana network, wallet providers, swap routers and exchanges, price and data sources, node providers, AI providers and hosting companies. They have their own terms and their own risks. We do not control them and we are not responsible for what they do or fail to do. If one of them stops working, changes or makes a mistake, Maschina may stop working or may act on wrong information.",
				"Links to other websites are for your convenience. We do not control those sites and do not endorse them.",
			],
		},
		{
			heading: "Your content and your data",
			body: [
				"You keep ownership of the things you create in Maschina, such as your machine settings and the notes you write. You give us the right to store, process and show them as needed to run the service for you.",
				[
					"How we handle personal information is described in the ",
					{ text: "privacy policy", href: "/privacy" },
					".",
				],
				"Transactions on the Solana network are public. Anyone can see them, including the ones your machines make, and we cannot take them down.",
			],
		},
		{
			heading: "Our property and the source code",
			body: [
				"The Maschina name, logo and designs belong to us, and these terms do not give you any right to use them except to refer to Maschina fairly and accurately.",
				[
					"Maschina's source code is source-available, which means you can read it. That is different from open source: what you may do with the code is set out by the license on the ",
					{ text: "license page", href: "/license" },
					", and these terms do not give you any rights in the code beyond that license.",
				],
				"If you send us ideas, suggestions or feedback, we may use them without paying you or crediting you.",
			],
		},
		{
			heading: "What you may not do",
			body: [
				"You may not use Maschina to do any of the following, and you may not let a machine do them:",
				{
					list: [
						"Break the law, or help someone else break it, including sanctions, money laundering, fraud and terrorist financing.",
						"Manipulate a market, for example by wash trading, spoofing, or pumping and dumping a token.",
						"Attack, overload or probe the service, or get around its limits, rate limits or security.",
						"Reverse engineer, scrape or copy the service in ways the license does not allow.",
						"Pretend to be someone else, or use someone else's wallet or account without permission.",
						"Use the service to harm other people, or to collect their information without their consent.",
						"Break the terms of a third party service that Maschina connects to.",
					],
				},
				[
					"If you find a security problem, please tell us through the ",
					{ text: "security disclosure", href: "/disclosure" },
					" page before you tell anyone else, and do not test it on anyone's money but your own.",
				],
			],
		},
		{
			heading: "Availability and changes to the service",
			body: [
				"Maschina is in active development. Features can change, break, move or be removed, and we do not promise that the service will always be available or free of errors.",
				"If we find a security problem, a market emergency or a legal requirement, we may pause machines, stop a kind of trading or stop the whole service for a time. While machines are paused you should still be able to withdraw your funds to your own wallet, unless a technical failure or the law prevents it.",
			],
		},
		{
			heading: "Suspending or ending your use",
			body: [
				"You can stop using Maschina at any time. Stop your machines and withdraw what is in their wallets first.",
				"We may suspend or end your access if you break these terms, if we have to by law, or if we think your use puts the service, other users or their funds at risk. If we do, we will tell you why when we can, and we will not stop you withdrawing your own funds unless the law or a technical failure prevents it.",
				"The parts of these terms that by their nature should continue after your use ends, including the sections on risk, disclaimers, liability and disputes, will continue.",
			],
		},
		{
			heading: "Disclaimers",
			body: [
				"The service is provided as it is and as it is available. To the fullest extent the law allows, we do not make any promise or warranty about it, written or unwritten, including any warranty that it will be accurate, reliable, secure, free of errors, always available, fit for a particular purpose or free of harm. We do not promise that a machine will make money, will avoid a loss, or will do what you meant it to do.",
				"The service has not been independently audited. Some places do not allow some of these exclusions, so some of them may not apply to you.",
			],
		},
		{
			heading: "Limits on our liability",
			body: [
				"To the fullest extent the law allows, Maschina Labs and the people who work on Maschina are not liable to you for any indirect, incidental, special, consequential or punitive loss, or for lost profits, lost trading gains, or loss of data, even if we have been told they might happen.",
				"We are also not liable for losses that come from market movements, from a trade you or your machine chose to make, from the failure of a third party service, from the loss or theft of your wallet or keys, or from anything outside our reasonable control.",
				"If we are found liable to you for anything else, our total liability for all claims will not be more than the greater of the fees you have paid us in the twelve months before the claim and one hundred Canadian dollars.",
				"Nothing in these terms limits a liability that the law does not allow to be limited, such as liability for fraud, for gross negligence, for wilful misconduct, or for death or personal injury.",
			],
		},
		{
			heading: "If you cause us a loss",
			body: [
				"If your breach of these terms, your misuse of the service or your break of the law causes a claim, loss or cost to us, you will cover it, including reasonable legal fees, to the extent the law allows.",
			],
		},
		{
			heading: "Governing law and disputes",
			body: [
				"These terms are governed by the laws of the Province of Alberta, Canada, and the federal laws of Canada that apply there, without regard to any rule that would send the question to some other law.",
				"If you have a problem with Maschina, please write to us first at the address below and give us thirty days to try to put it right. Most problems can be settled that way.",
				"If we cannot settle it, the courts of Alberta can hear it, and you and we both accept those courts. Nothing here takes away any right you have under the law of the place where you live that cannot be waived by agreement.",
			],
		},
		{
			heading: "Changes to these terms",
			body: [
				"We may change these terms. When we do, we will change the date at the top of this page, and if the change is a big one we will also tell you in the app or on the website. A change applies from the date it is posted, and if you keep using Maschina after that, you accept the new terms. If you do not accept them, stop using Maschina.",
			],
		},
		{
			heading: "The rest",
			body: [
				"These terms, together with the pages they link to, are the whole agreement between you and us about Maschina. If a part of them is found to be unenforceable, the rest still applies. If we do not enforce a part of them, that is not a promise that we never will. You may not hand your rights under these terms to anyone else without our permission. We may hand ours to a successor of Maschina. We are not responsible for a failure caused by something outside our reasonable control, such as an outage of the network or a provider, a law, a war or a natural disaster. These terms are written in English, and if they are translated, the English version is the one that counts. We may send you notices by email, in the app or on the website.",
			],
		},
		{
			heading: "Contact",
			body: [
				[
					"Questions about these terms, or anything to do with Maschina, can go to ",
					{ text: "asher@maschina.dev", href: "mailto:asher@maschina.dev" },
					".",
				],
			],
		},
	],
};
