/**
 * The four steps between an idea and a settled trade. Every line is a claim about the product and has to be
 * true: the machine holds no keys, the budget ledger is not the machine's to edit, only the signer can ask for a
 * signature, the wallet's policy only pays the owner, and trades settle on Solana. No vendor is named. Each
 * step has a color of its own so the four read as one chain.
 */
const STEPS = [
	{
		title: "The AI proposes.",
		text: "Your machine reads the market and proposes a trade. It holds no keys and cannot move money.",
		color: "bg-[oklch(0.8_0.11_300)]",
		ink: "text-[oklch(0.8_0.11_300)]",
	},
	{
		title: "The rules decide.",
		text: "Budgets live in a ledger the machine cannot edit. Every limit is checked before anything is signed.",
		color: "bg-[oklch(0.82_0.06_250)]",
		ink: "text-[oklch(0.82_0.06_250)]",
	},
	{
		title: "The signer signs.",
		text: "Only the signer can ask for a signature, and the wallet's policy only ever pays the owner.",
		color: "bg-[oklch(0.83_0.1_215)]",
		ink: "text-[oklch(0.83_0.1_215)]",
	},
	{
		title: "The record keeps it.",
		text: "Every trade settles on Solana, where anyone can check it.",
		color: "bg-[oklch(0.82_0.17_150)]",
		ink: "text-[oklch(0.82_0.17_150)]",
	},
] as const;

export function HowItWorks() {
	return (
		<section aria-label="How it works" className="relative bg-black px-(--gutter) py-32">
			<p className="text-[12px] text-white uppercase tracking-[0.08em]">How it works</p>
			<h2 className="mt-5 max-w-[18ch] font-display font-normal text-[clamp(2rem,4.2vw,4rem)] text-[oklch(0.95_0.01_300)] leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				From idea to settled, in four steps.
			</h2>
			<p className="mt-5 text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400">
				The AI never holds the keys.
			</p>
			<ol aria-label="The four steps" className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{STEPS.map((step, index) => (
					<li key={step.title} className="bg-white/[0.04] p-6 pb-10">
						<div className="flex items-center gap-3">
							<span data-marker aria-hidden="true" className={`size-2.5 ${step.color}`} />
							<span className={`text-[13px] tabular-nums ${step.ink}`}>0{index + 1}</span>
						</div>
						<h3 className="mt-12 text-[22px] text-white leading-tight tracking-[-0.02em]">
							{step.title}
						</h3>
						<p className="mt-3 text-[15px] text-neutral-400 leading-snug">{step.text}</p>
					</li>
				))}
			</ol>
		</section>
	);
}
