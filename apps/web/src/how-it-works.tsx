import { useEffect, useRef, useState } from "react";

/**
 * The four steps between an idea and a settled trade, as four posters in a strip. Every line is a claim about
 * the product and has to be true: the machine holds no keys, the budget ledger is not the machine's to edit,
 * only the signer can ask for a signature, the wallet's policy only pays the owner, and trades settle on
 * Solana. No vendor is named. Each poster is a bold flat color of its own.
 */
const STEPS = [
	{
		title: "The AI proposes.",
		text: "Your machine reads the market and proposes a trade. It holds no keys and cannot move money.",
		chips: ["Holds no keys", "Cannot move money"],
		poster: "bg-[oklch(0.58_0.22_295)] text-white",
		stroke: "[-webkit-text-stroke:2px_oklch(1_0_0/0.28)]",
	},
	{
		title: "The rules decide.",
		text: "Budgets live in a ledger the machine cannot edit. Every limit is checked before anything is signed.",
		chips: ["Budget ledger", "Checked before signing"],
		poster: "bg-[oklch(0.88_0.015_260)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.16)]",
	},
	{
		title: "The signer signs.",
		text: "Only the signer can ask for a signature, and the wallet's policy only ever pays the owner.",
		chips: ["Signer only", "Pays the owner only"],
		poster: "bg-[oklch(0.8_0.12_205)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.2)]",
	},
	{
		title: "The record keeps it.",
		text: "Every trade settles on Solana, where anyone can check it.",
		chips: ["Settles on Solana", "Open to anyone"],
		poster: "bg-[oklch(0.82_0.19_150)] text-black",
		stroke: "[-webkit-text-stroke:2px_oklch(0_0_0/0.2)]",
	},
] as const;

/** A poster's width and the gap beside it, used to move one poster at a time when the width cannot be read. */
const POSTER = 448;
const GAP = 12;

function Arrow({ direction }: { direction: "left" | "right" }) {
	return (
		<svg
			viewBox="0 0 12 12"
			className="size-3"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="square"
			aria-hidden="true"
		>
			<path d={direction === "right" ? "M4.5 2.5 8 6 4.5 9.5" : "M7.5 2.5 4 6l3.5 3.5"} />
		</svg>
	);
}

export function HowItWorks() {
	const list = useRef<HTMLOListElement>(null);
	const [edge, setEdge] = useState({ start: true, end: true });

	// Whether there is more to see on either side, so an arrow with nowhere to go is off.
	const measure = () => {
		const strip = list.current;
		if (!strip) return;
		setEdge({
			start: strip.scrollLeft <= 1,
			end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
		});
	};

	useEffect(() => {
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	const move = (direction: 1 | -1) => {
		const poster = list.current?.firstElementChild as HTMLElement | null | undefined;
		list.current?.scrollBy({
			left: direction * ((poster?.offsetWidth || POSTER) + GAP),
			behavior: "smooth",
		});
	};

	const arrow =
		"grid size-11 place-items-center bg-white/[0.07] text-white transition-colors hover:bg-white/[0.12] disabled:text-neutral-700 disabled:hover:bg-white/[0.07]";

	return (
		<section aria-label="How it works" className="relative bg-black py-28">
			<div className="flex flex-col gap-10 px-(--gutter) lg:flex-row lg:items-end lg:justify-between">
				<h2 className="max-w-[40ch] font-display font-normal text-[clamp(2rem,4vw,4rem)] leading-[1.02] tracking-[-0.035em]">
					<span className="text-white">
						An AI proposes the trade. Maschina decides if it happens.
					</span>{" "}
					<span className="text-neutral-500">
						Rules checked before anything is signed. Every trade settles where anyone can check.
					</span>
				</h2>
				<div className="flex shrink-0 gap-3">
					<button
						type="button"
						aria-label="Previous step"
						disabled={edge.start}
						onClick={() => move(-1)}
						className={arrow}
					>
						<Arrow direction="left" />
					</button>
					<button
						type="button"
						aria-label="Next step"
						disabled={edge.end}
						onClick={() => move(1)}
						className={arrow}
					>
						<Arrow direction="right" />
					</button>
				</div>
			</div>
			<ol
				ref={list}
				aria-label="The four steps"
				onScroll={measure}
				className="mt-16 flex snap-x snap-mandatory scroll-pl-(--gutter) gap-3 overflow-x-auto pr-(--gutter) pl-(--gutter) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{STEPS.map((step, index) => (
					<li key={step.title} className="w-[min(78vw,28rem)] shrink-0 snap-start">
						<div
							data-poster
							className={`relative flex aspect-[4/5] flex-col justify-between overflow-hidden p-6 ${step.poster}`}
						>
							<span
								data-number
								aria-hidden="true"
								className={`pointer-events-none absolute -right-6 -bottom-20 select-none font-display text-[24rem] text-transparent leading-none ${step.stroke}`}
							>
								{index + 1}
							</span>
							<span className="relative text-[13px] tabular-nums">0{index + 1}</span>
							<h3 className="relative max-w-[10ch] font-display font-normal text-[clamp(2.25rem,3.4vw,3.25rem)] leading-[1] tracking-[-0.035em]">
								{step.title}
							</h3>
						</div>
						<p className="mt-4 text-[15px] text-neutral-400 leading-snug">{step.text}</p>
						<ul className="mt-4 flex flex-wrap gap-2">
							{step.chips.map((chip) => (
								<li key={chip} className="bg-white/[0.07] px-3 py-1.5 text-[13px] text-neutral-300">
									{chip}
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
		</section>
	);
}
