import type { LegalDoc } from "../legal.tsx";

/**
 * Maschina's risk disclosure: the ways money can be lost using it, said plainly and specifically, before anyone puts
 * real money into a machine. It names the risks that come from trading, from machines and the AI that may run them,
 * from wallets and the network, and from the people and services Maschina depends on, and it says what the limits do
 * and do not do. It shows no figure and promises no result. It has not yet been reviewed by a lawyer.
 */
export const RISK: LegalDoc = {
	title: "Risk Disclosure",
	updated: "October 9, 2026",
	intro: [
		"Using Maschina with real money carries real risk. This page says what the risks are, as plainly as we can, so that you decide with your eyes open. Please read all of it before you put money into a machine.",
	],
	sections: [
		{
			heading: "The short version",
			body: [
				"This is a summary. The full disclosure below is what counts.",
				{
					list: [
						"You can lose all of the money you put into a machine, and in some cases a machine can lose it quickly.",
						"A machine acts on its own, at any hour, and does exactly what its settings allow, even when that turns out to be a mistake.",
						"Limits keep a machine inside a boundary. They do not make it safe.",
						"An AI can be wrong, and nobody checks its decisions as they happen.",
						"Transactions cannot be undone, and Maschina is early software that has not been independently audited.",
						"Only use money you can afford to lose, and start on paper.",
					],
				},
			],
		},
		{
			heading: "What Maschina is, and is not",
			body: [
				[
					"Maschina is run by Maschina Labs. It is software for giving an AI a wallet and a job. It is not a bank, a broker, an exchange or an investment adviser. Your money in a machine's wallet is not insured and is not covered by any deposit protection scheme. Nothing here is financial advice. See also the ",
					{ text: "terms of service", href: "/terms" },
					".",
				],
			],
		},
		{
			heading: "You can lose everything",
			body: [
				"Crypto assets can lose most or all of their value, sometimes in minutes. A machine that trades them can lose the money it was given. There is no safety net, no recovery service and no one who can reverse a loss.",
				"A machine can lose money even when everything works as intended. A trade can be a good idea that fails, and a machine that is right most of the time can still lose more on the times it is wrong than it makes on the times it is right.",
			],
		},
		{
			heading: "Market risks",
			body: [
				"Trading carries risks that no software removes:",
				{
					list: [
						"Prices can move fast and far, and a machine can buy near a high and sell near a low.",
						"A trade can fill at a worse price than the one shown when it was decided, because the price moved, because there was not enough supply, or because the trade itself moved the price.",
						"Some tokens are hard or impossible to sell. A machine can end up holding a token it cannot get rid of.",
						"Tokens can be scams. Their creators can take the money out, create more of them, or freeze them.",
						"Other traders, and the software they run, can see a trade coming and profit from it at a machine's cost.",
						"Markets can stop working, and prices can be wrong or out of date.",
					],
				},
				"Maschina does not stop a machine from buying a risky token unless you set a limit that does. The tokens a machine may use, and how much it may spend on them, are your choice.",
			],
		},
		{
			heading: "Machine and automation risks",
			body: [
				"A machine runs by itself, and that is both the point and the risk.",
				{
					list: [
						"A machine does what its settings say. If you set it up wrongly, it will carry out the mistake until it is stopped.",
						"A machine runs at any hour and does not need you to be watching, so a loss can happen while you are asleep.",
						"Software has bugs, including ours. A bug can cause a trade that should not happen, or stop one that should.",
						"A strategy that worked before can stop working when the market changes.",
						"A machine that waits for the price to come back can wait a long time, or forever.",
						"A machine made on paper has no real fees, no real delays and no real price movement from its own trades, so it can do better on paper than it ever would with money.",
					],
				},
			],
		},
		{
			heading: "AI risks",
			body: [
				"Some machines, and the manager, use an AI model to decide what to do or to answer you. An AI model can be wrong. It can misread a situation, state something false with confidence, act on out of date information, or be steered by text it reads from a website, a message or a token's own description. Its decisions are made by a program and not checked by a person as they happen.",
				"You are responsible for what you let an AI decide. Do not give a machine more money than you can afford to lose, and do not treat what the manager says as advice.",
			],
		},
		{
			heading: "What limits do and do not do",
			body: [
				"Maschina checks each trade a machine wants to make against the limits you set before anything is signed, and a trade that fails the check does not happen. You can limit how much a machine can spend in total, in one trade and in one day, and which tokens it may use.",
				"Limits keep a machine inside a boundary. They do not make it safe. A machine that stays inside every limit can still lose all that it was given, and a limit set too wide protects you very little. A limit only protects against what it was set to prevent, and a loss can come from something no limit covers.",
			],
		},
		{
			heading: "Wallet and technical risks",
			body: [
				"Each machine has its own wallet, and the keys to it are held by a third party wallet provider. If that provider, or the way we connect to it, is hacked, fails or goes out of business, funds could be lost or locked.",
				{
					list: [
						"Anyone who controls your own wallet can act as you in Maschina, and can withdraw from a machine. Protect your wallet and your recovery phrase.",
						"Transactions on the Solana network cannot be reversed. Funds sent to a wrong address, or paid out by mistake, usually cannot be recovered.",
						"The network can be slow, congested or down, and a transaction can fail and still cost a fee.",
						"The services that give us prices and send our transactions can fail or give wrong answers.",
						"Maschina is early software. It has not been independently audited, and it can break, change or stop.",
						"We may pause machines or stop the service to protect people and funds. While machines are paused you should still be able to withdraw, unless a technical failure or the law prevents it.",
					],
				},
			],
		},
		{
			heading: "Third parties",
			body: [
				"Maschina depends on the Solana network, on a wallet provider, on swap and price services, on node providers and on AI providers, none of which we control. If one of them fails, changes, is attacked or makes a mistake, a machine can lose money or stop working. We are not responsible for them.",
			],
		},
		{
			heading: "Legal and tax risks",
			body: [
				"The law on crypto assets and automated trading is unsettled and changes. A change could affect what you can do with Maschina, or whether you can use it at all where you live. You are responsible for knowing and following the laws that apply to you.",
				"What a machine does can have tax consequences for you, including each trade. Maschina does not give tax advice and does not report your trades. Please keep your own records and get advice from someone qualified.",
			],
		},
		{
			heading: "Results and examples",
			body: [
				"Numbers, charts and screenshots on this site and in the app may use sample data, and are there to show how the product looks. A result shown for one machine, in one period, tells you very little about what another machine, or the same machine later, will do. Past results, on paper or with real money, do not predict future results. We do not promise or imply that any machine will make money.",
			],
		},
		{
			heading: "How to take less risk",
			body: [
				"These steps can lower the risk. They cannot remove it.",
				{
					list: [
						"Make a machine on paper first and watch what it does with live prices.",
						"Start with a small amount, and add more only if you understand what the machine is doing.",
						"Set limits that are tight enough to matter, and check them again after you change a machine.",
						"Read a machine's record, including the trades it refused and why.",
						"Keep your own wallet safe, and withdraw what you are not using.",
						"Never use money you cannot afford to lose, borrowed money, or money you need for something else.",
					],
				},
			],
		},
		{
			heading: "Your decision",
			body: [
				[
					"Whether to use Maschina, and how much to put into a machine, is your decision alone, and you bear its result. If you do not understand a risk described here, or you are not comfortable with it, do not use real money. If you have questions, write to ",
					{ text: "legal@maschina.dev", href: "mailto:legal@maschina.dev" },
					".",
				],
			],
		},
	],
};
