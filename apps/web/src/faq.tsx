import { useId, useState } from "react";

/**
 * Short questions and short answers, opened one at a time. Every answer is a claim about the product and has to
 * be true, and none runs past a couple of lines: nobody wants to read an essay, they want to see their question
 * answered. A machine spends only inside the budget and limits its owner set, and Maschina never holds the owner's own wallet keys; every trade is checked against the
 * budget before it is signed; a machine can be made on paper against live prices; Range Finder has traded real
 * money on Solana since September 28; the code is source-available, not open source.
 */
const QUESTIONS = [
	{
		question: "What is Maschina?",
		answer:
			"A way to give an AI its own wallet and a job, like trading SOL. It works on its own, inside limits you set.",
	},
	{
		question: "What can a machine do with my money?",
		answer:
			"Only what you allow: it spends inside the budget and limits you set, and Maschina never holds your own wallet's keys.",
	},
	{
		question: "What if it makes a bad trade?",
		answer:
			"Every trade is checked against your budget and limits before it is signed, so it cannot spend more than you gave it.",
	},
	{
		question: "Do I need money to try it?",
		answer:
			"No. Make a machine on paper and watch it trade against live prices without risking anything.",
	},
	{
		question: "Is it live with real money?",
		answer:
			"Yes. Range Finder has traded real money on Solana since September 28, and every trade is on chain.",
	},
	{
		question: "Can I read the code?",
		answer: "Yes. It is source-available: you can read it, but it is not open source.",
	},
] as const;

export function Faq() {
	const base = useId();
	const [open, setOpen] = useState<number | null>(null);

	return (
		<section
			aria-label="Questions"
			className="relative flex flex-col items-center bg-black px-(--gutter) py-20 sm:py-32"
		>
			<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				Before you start.
			</h2>
			<div className="mt-16 flex w-full justify-center">
				<ul className="flex w-full max-w-3xl flex-col">
					{QUESTIONS.map((item, index) => {
						const shown = open === index;
						return (
							<li key={item.question} className="bg-white/[0.04] [&:not(:last-child)]:mb-3">
								<button
									type="button"
									aria-expanded={shown}
									aria-controls={`${base}-${index}`}
									onClick={() => setOpen(shown ? null : index)}
									className="group flex w-full cursor-pointer items-center justify-between gap-6 px-6 py-5 text-left"
								>
									<span className="text-[clamp(1.125rem,1.6vw,1.375rem)] text-white tracking-[-0.01em]">
										{item.question}
									</span>
									<span
										data-mark
										aria-hidden="true"
										className="relative grid size-9 shrink-0 place-items-center bg-white/[0.08] text-white transition-colors duration-200 group-hover:bg-white/[0.18] motion-reduce:transition-none"
									>
										<span className="absolute h-px w-3.5 bg-current" />
										<span
											data-upright
											className={`absolute h-3.5 w-px origin-center bg-current transition-transform duration-300 motion-reduce:transition-none ${
												shown ? "scale-y-0" : "scale-y-100"
											}`}
										/>
									</span>
								</button>
								<div
									id={`${base}-${index}`}
									data-answer
									{...(shown ? {} : { inert: true, "aria-hidden": true })}
									className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
										shown ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
									}`}
								>
									<div className="min-h-0 overflow-hidden">
										<p className="max-w-[48ch] px-6 pb-6 text-[16px] text-neutral-400 leading-[1.5]">
											{item.answer}
										</p>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
