const FACTS = [
	{
		title: "Since September 28",
		text: "Range Finder has traded real money on Solana.",
	},
	{
		title: "On chain",
		text: "Every trade settles on Solana, where anyone can check it.",
	},
	{
		title: "Outside the AI",
		text: "Budgets and rules live in a ledger the machine can't edit.",
	},
] as const;

/**
 * The section under the hero. The hero is shorter than the screen, so this one's top edge shows at the
 * bottom of the first view. Only claims that are true and checkable go here.
 */
export function Proof() {
	return (
		<section
			aria-label="Proof"
			className="border-white/10 border-t bg-[oklch(0.15_0.008_285)] px-(--gutter) py-20"
		>
			<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
				<h2 className="font-display font-normal text-[clamp(1.75rem,3vw,2.75rem)] text-neutral-100 leading-tight tracking-[-0.03em]">
					The record is public.
				</h2>
				<a
					href="/live"
					className="inline-flex w-fit items-center bg-white/[0.13] px-5 py-3 text-[15px] text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					See the live record
				</a>
			</div>
			<ul className="mt-10 grid gap-3 sm:grid-cols-3">
				{FACTS.map((fact) => (
					<li key={fact.title} className="bg-white/[0.04] p-6">
						<h3 className="text-[15px] text-neutral-100">{fact.title}</h3>
						<p className="mt-2 text-[15px] text-neutral-400 leading-snug">{fact.text}</p>
					</li>
				))}
			</ul>
		</section>
	);
}
