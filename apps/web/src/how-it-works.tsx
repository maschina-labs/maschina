import { useEffect, useId, useRef, useState } from "react";

/**
 * The four steps between an idea and a settled trade. The headline is the control: each of its four sentences
 * is one step, and clicking one brings you to that step's slide and lights the sentence in the same silver and
 * pearl gradient as the hero's headline, while the others stay gray. Every line is a claim about the product and
 * has to be true: the machine holds no keys, the budget ledger is not the machine's to edit, only the signer can
 * ask for a signature, the wallet's policy only pays the owner, and trades settle on Solana. No vendor is named.
 * Each slide has a bold flat color of its own.
 */
const STEPS = [
	{
		sentence: "An AI proposes the trade.",
		title: "The AI proposes.",
		text: "Your machine reads the market and proposes a trade. It holds no keys and cannot move money.",
		chips: ["Holds no keys", "Cannot move money"],
		poster: "bg-[oklch(0.58_0.22_295)] text-white",
		stroke: "[-webkit-text-stroke:2px_oklch(1_0_0/0.28)]",
	},
	{
		sentence: "The rules decide if it happens.",
		title: "The rules decide.",
		text: "Budgets live in a ledger the machine cannot edit. Every limit is checked before anything is signed.",
		chips: ["Budget ledger", "Checked before signing"],
		poster: "bg-[oklch(0.88_0.015_260)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.16)]",
	},
	{
		sentence: "Only the signer can sign it.",
		title: "The signer signs.",
		text: "Only the signer can ask for a signature, and the wallet's policy only ever pays the owner.",
		chips: ["Signer only", "Pays the owner only"],
		poster: "bg-[oklch(0.8_0.12_205)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.2)]",
	},
	{
		sentence: "Every trade settles where anyone can check.",
		title: "The record keeps it.",
		text: "Every trade settles on Solana, where anyone can check it.",
		chips: ["Settles on Solana", "Open to anyone"],
		poster: "bg-[oklch(0.82_0.19_150)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.2)]",
	},
] as const;

/** How long each step stays up before the next one lights, when nobody is using the section. */
const PLAY_MS = 6500;

export function HowItWorks() {
	const base = useId();
	const section = useRef<HTMLElement>(null);
	const [current, setCurrent] = useState(0);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [visible, setVisible] = useState(true);
	const held = hovered || focused;

	// Only play while the section is actually on screen, so nothing runs where nobody can see it.
	useEffect(() => {
		const node = section.current;
		if (!node || typeof IntersectionObserver === "undefined") return;
		const watcher = new IntersectionObserver(
			([entry]) => setVisible(Boolean(entry?.isIntersecting)),
			{
				threshold: 0.4,
			},
		);
		watcher.observe(node);
		return () => watcher.disconnect();
	}, []);

	// It plays by itself: each step stays up a few seconds and then the next lights, round to the first again.
	// It waits while the cursor is over the section or something in it has the keyboard's focus, starts its count
	// again whenever the step changes (so a step you chose is not whisked away), and does not play at all for
	// anyone who asked for less motion.
	useEffect(() => {
		if (held || !visible) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const timer = setTimeout(() => setCurrent((now) => (now + 1) % STEPS.length), PLAY_MS);
		return () => clearTimeout(timer);
	}, [current, held, visible]);

	return (
		<section
			ref={section}
			aria-label="How it works"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onFocus={() => setFocused(true)}
			onBlur={() => setFocused(false)}
			className="relative flex min-h-dvh flex-col justify-center bg-black px-(--gutter) py-[clamp(4rem,10dvh,7rem)]"
		>
			<h2 className="max-w-[44ch] font-display text-[clamp(1.75rem,3vw,3rem)] leading-[1.14] tracking-[-0.025em]">
				{STEPS.map((step, index) => (
					<span key={step.sentence} className="mr-[0.22em]">
						{index > 0 ? " " : null}
						<button
							type="button"
							aria-pressed={current === index}
							aria-controls={`${base}-${index}`}
							onClick={() => setCurrent(index)}
							className={`inline cursor-pointer text-left font-normal transition-colors duration-300 motion-reduce:transition-none ${
								current === index
									? "bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] text-transparent"
									: "text-neutral-500 hover:text-neutral-300"
							}`}
						>
							{step.sentence}
						</button>
					</span>
				))}
			</h2>

			<div className="mt-12 grid">
				{STEPS.map((step, index) => {
					const shown = current === index;
					return (
						<div
							key={step.title}
							id={`${base}-${index}`}
							data-slide
							{...(shown ? {} : { inert: true, "aria-hidden": true })}
							className={`col-start-1 row-start-1 grid gap-8 transition-opacity duration-500 motion-reduce:transition-none lg:grid-cols-2 ${
								shown ? "opacity-100" : "pointer-events-none opacity-0"
							}`}
						>
							<div
								data-poster
								className={`relative h-[min(34dvh,22rem)] overflow-hidden p-6 sm:p-8 ${step.poster}`}
							>
								<span
									data-number
									aria-hidden="true"
									className={`pointer-events-none absolute -right-4 -bottom-16 select-none font-display text-[20rem] text-transparent leading-none ${step.stroke}`}
								>
									{index + 1}
								</span>
								<span className="relative text-[13px] tabular-nums">0{index + 1}</span>
							</div>
							<div className="flex flex-col justify-center">
								<h3 className="text-[13px] text-neutral-400 uppercase tracking-[0.08em]">
									{step.title}
								</h3>
								<p className="mt-5 max-w-[30ch] text-[clamp(1.25rem,2vw,1.75rem)] text-neutral-200 leading-[1.4] tracking-[-0.005em]">
									{step.text}
								</p>
								<ul className="mt-8 flex flex-wrap gap-2">
									{step.chips.map((chip) => (
										<li
											key={chip}
											data-chip
											className="bg-white/[0.07] px-3 py-1.5 text-[13px] text-neutral-300"
										>
											{chip}
										</li>
									))}
								</ul>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
