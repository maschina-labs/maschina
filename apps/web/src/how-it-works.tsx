import { useEffect, useRef, useState } from "react";

/**
 * How it works, told as a story that follows one trade down the page (scrollytelling). The section is tall and
 * its screen stays pinned in place while you scroll past; how far you have scrolled decides which of the four
 * steps is lit and how much of a small trade card has been built. It uses the browser's own scrolling and only
 * listens, so it never takes the scroll over, and scrolling back up un-tells the story.
 *
 * Every line is a claim about the product and has to be true: a machine only proposes, the budget and limits are
 * checked before anything is signed, only the signer can sign and its wallet only pays the owner, and every trade
 * settles on Solana where anyone can check it. The card is an example with no numbers on it, so nothing on it
 * could pass for a real trade. No vendor is named.
 *
 * For anyone who asked for less motion it is not pinned and not tall: the whole story at once, every step open
 * and every fact shown.
 */
const STEPS = [
	{
		title: "AI proposes",
		line: "It reads the market and suggests a trade.",
		marker: "bg-[oklch(0.8_0.11_300)]",
		status: "Proposed",
		facts: ["Buy SOL with USDC", "Proposed by the AI"],
	},
	{
		title: "Rules check",
		line: "Your budget and limits, before anything is signed.",
		marker: "bg-[oklch(0.82_0.06_250)]",
		status: "Checked",
		facts: ["Within the budget", "Within the limits"],
	},
	{
		title: "Signer signs",
		line: "Only the signer can sign, and only to pay you.",
		marker: "bg-[oklch(0.83_0.1_215)]",
		status: "Signed",
		facts: ["Signed by the signer", "Pays the owner only"],
	},
	{
		title: "Anyone can verify",
		line: "Every trade settles on Solana.",
		marker: "bg-[oklch(0.82_0.17_150)]",
		status: "Settled",
		facts: ["Settled on Solana", "Open to anyone"],
	},
] as const;

const LAST = STEPS.length - 1;

export function HowItWorks() {
	const section = useRef<HTMLElement>(null);
	const [reduced] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const [step, setStep] = useState(0);

	// The story moves with the scroll: through the pinned stretch, a quarter of it for each step.
	useEffect(() => {
		if (reduced) return;
		const update = () => {
			const node = section.current;
			if (!node) return;
			const box = node.getBoundingClientRect();
			const scrollable = box.height - window.innerHeight;
			if (scrollable <= 0) return;
			const progress = Math.min(1, Math.max(0, -box.top / scrollable));
			setStep(Math.min(LAST, Math.floor(progress * STEPS.length)));
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, [reduced]);

	const at = reduced ? LAST : step;

	return (
		<section
			ref={section}
			aria-label="How it works"
			className={`relative bg-black ${reduced ? "" : "h-[360dvh]"}`}
		>
			<div
				data-pin
				className={`flex flex-col items-center justify-center px-(--gutter) ${
					reduced ? "py-32" : "sticky top-0 h-dvh py-16"
				}`}
			>
				<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2rem,4.4vw,4rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
					How it works.
				</h2>
				<div className="mt-12 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
					<ol aria-label="The four steps" className="flex flex-col gap-6">
						{STEPS.map((item, index) => {
							const active = !reduced && index === step;
							const open = reduced || active;
							const color = reduced
								? "text-white"
								: active
									? "bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] -mb-[0.14em] text-transparent"
									: index < step
										? "text-neutral-400"
										: "text-neutral-700";
							return (
								<li key={item.title} aria-current={active ? "step" : undefined}>
									<div className="flex items-baseline gap-4">
										<span
											data-marker
											aria-hidden="true"
											className={`size-2.5 shrink-0 ${item.marker}`}
										/>
										<span className="text-[13px] text-neutral-500 tabular-nums">0{index + 1}</span>
										<h3
											className={`font-display font-normal text-[clamp(1.75rem,3.2vw,3rem)] leading-[1.1] tracking-[-0.025em] transition-colors duration-300 motion-reduce:transition-none ${color}`}
										>
											{item.title}
										</h3>
									</div>
									<div
										data-line
										{...(open ? {} : { inert: true, "aria-hidden": true })}
										className={`grid pl-[3.75rem] transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${
											open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
										}`}
									>
										<div className="min-h-0 overflow-hidden">
											<p className="mt-2 max-w-[34ch] text-[clamp(1rem,1.4vw,1.25rem)] text-neutral-400 leading-snug">
												{item.line}
											</p>
										</div>
									</div>
								</li>
							);
						})}
					</ol>

					<div
						data-card
						aria-hidden="true"
						className="w-full max-w-md justify-self-center bg-white/[0.04] p-6 sm:p-8"
					>
						<div className="flex items-center justify-between">
							<div data-status className="flex items-center gap-3 text-[15px] text-white">
								<span className={`size-2.5 ${STEPS[at]?.marker}`} />
								{STEPS[at]?.status}
							</div>
							<span className="bg-white/[0.08] px-2.5 py-1 text-[12px] text-neutral-400">
								Example
							</span>
						</div>
						<ul className="mt-8 flex flex-col gap-3">
							{STEPS.flatMap((item, index) =>
								item.facts.map((fact) => (
									<li
										key={fact}
										data-fact
										className={`flex items-center gap-3 bg-white/[0.04] px-4 py-3 text-[15px] text-neutral-200 transition-opacity duration-500 motion-reduce:transition-none ${
											index <= at ? "opacity-100" : "opacity-0"
										}`}
									>
										<span className={`size-2 shrink-0 ${item.marker}`} />
										{fact}
									</li>
								)),
							)}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
