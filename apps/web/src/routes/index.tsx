import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Home,
});

/** What a machine is, in the order someone meets it. */
const PARTS = [
	{
		name: "Its own wallet",
		detail: "Not yours. A machine holds its own funds, at an address you can look up.",
	},
	{
		name: "A budget",
		detail:
			"You decide what it may spend, in total and per trade and per day. It cannot spend past that.",
	},
	{
		name: "Rules",
		detail: "Which tokens it may touch, how far a price may move, when it may act.",
	},
	{
		name: "A record",
		detail: "Every decision, every trade, every refusal, written down and never edited.",
	},
	{
		name: "An off switch",
		detail: "Stop it and it stops. The next thing it was going to do does not happen.",
	},
];

/** The limits, stated as things that cannot happen rather than things we promise not to do. */
const CANNOT = [
	{
		claim: "It cannot withdraw your money",
		how: "The wallet's policy allows funds to move to your address and nowhere else. Maschina cannot change that on your behalf.",
	},
	{
		claim: "It cannot spend past its budget",
		how: "Money is held before a trade is signed and settled after, inside one database transaction. Two trades cannot both spend the last of it.",
	},
	{
		claim: "It cannot act without being recorded",
		how: "The intent is written down before anything is signed, so a crash leaves a question the chain can answer rather than a mystery.",
	},
	{
		claim: "It cannot be talked into it",
		how: "Every signature is checked against your rules, and then checked again by the wallet provider, which knows nothing about us. Either can refuse.",
	},
];

function Home() {
	return (
		<div className="space-y-16 py-4 sm:py-8">
			<section className="space-y-5">
				<h1 className="max-w-3xl text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
					A machine with its own wallet, a budget it cannot exceed, and no way to withdraw your
					money.
				</h1>
				<p className="max-w-2xl text-lg text-muted-foreground">
					Maschina runs machines that work while you do not. Trading is the first job. You set what
					one is allowed to do. It does that, and only that, and writes down everything it did.
				</p>
				<p className="text-muted-foreground text-sm">
					Being built in the open, on Solana. Not open yet.
				</p>
			</section>

			<section className="space-y-6">
				<h2 className="font-semibold text-2xl tracking-tight">What a machine is</h2>
				<dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
					{PARTS.map((part) => (
						<div key={part.name} className="space-y-1">
							<dt className="font-medium">{part.name}</dt>
							<dd className="text-muted-foreground text-sm">{part.detail}</dd>
						</div>
					))}
				</dl>
			</section>

			<section className="space-y-6">
				<h2 className="font-semibold text-2xl tracking-tight">What it cannot do</h2>
				<p className="max-w-2xl text-muted-foreground text-sm">
					Every one of these is something the software is unable to do, rather than something we
					have promised not to.
				</p>
				<ul className="space-y-5">
					{CANNOT.map((item) => (
						<li key={item.claim} className="max-w-3xl border-l-2 pl-4">
							<p className="font-medium">{item.claim}</p>
							<p className="text-muted-foreground text-sm">{item.how}</p>
						</li>
					))}
				</ul>
			</section>

			<section className="space-y-3 border-t pt-8">
				<h2 className="font-semibold text-xl tracking-tight">Where this is</h2>
				<p className="max-w-2xl text-muted-foreground text-sm">
					Maschina is being built now, in public, one piece at a time. The machines run, the limits
					hold, and the parts that are not finished are not pretended to be. When the first machines
					are running for real, their records will be on this page, because a machine's history is
					the only argument worth making.
				</p>
				<p className="text-muted-foreground text-sm">
					Questions:{" "}
					<a
						className="underline underline-offset-4 hover:text-foreground"
						href="mailto:info@maschina.dev"
					>
						info@maschina.dev
					</a>
				</p>
			</section>
		</div>
	);
}
