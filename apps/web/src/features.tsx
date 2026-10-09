import { useRef, useState } from "react";
import { Backdrop } from "./backdrop.tsx";

/**
 * The app, a screen at a time, in one slider: a left aligned heading and one gray line that change with the screen,
 * then the whole screen, with arrows and a count under it. It takes one section's height instead of four, and the reader chooses the pace. It slides on
 * plain CSS scroll snapping, so a swipe or a trackpad works without any script, the arrows only scroll that same
 * track by one screen, and the count follows wherever it stops. Headings are left aligned. The screens sit on a cool silver backdrop, a second tone of the one under the preview. A mesh, particles and the
 * ribbon were tried behind them and taken out; the last version with them is in the history.
 *
 * Every screen was captured the way the preview under the hero was (a 1419 by 900 window at twice its pixels,
 * with the app's edge handles hidden), on screens that fill the frame, so all are the same shape. They come from
 * the app running locally with its built-in sample data (the preview says so); nothing here is a real person's
 * trades or results.
 *
 * The last slide is about making it yours. What exists today is choosing the kind of machine, its band and
 * floor, and its limits; rearranging your own screens and tiles is not built, and it says so.
 */
const FEATURES = [
	{
		name: "portfolio",
		title: "See the whole portfolio at a glance.",
		line: "Profit over time, what is in play with your machines, and what the network fees came to.",
		alt: "The Portfolio screen of the Maschina app: a chart of profit over time, a card for realized profit, the amount in play with machines, what it holds, the fees paid and the best machine.",
	},
	{
		name: "decisions",
		title: "Every decision is written down.",
		line: "A machine records what it decided and why before anything moves, and the ones the rules stopped are marked.",
		alt: "The Machine screen of the Maschina app: one machine's record, listing each decision to trade, each buy and sell, and a refusal with its reason, beside buttons to pause or stop it and to add money.",
	},
	{
		name: "manager",
		title: "Ask your manager.",
		line: "Ask about your machines, the market or what to do next, with your machines listed beside the chat.",
		alt: "The Manager screen of the Maschina app: a chat to ask about your machines, a list of them on the left, and a paper trader with its worth, cash and recent decisions on the right.",
	},
	{
		name: "customize",
		title: "Make it yours.",
		line: "Set every limit on a machine yourself. Rearranging your own screens and tiles is coming soon.",
		alt: "The New machine screen of the Maschina app: a choice of range finder, fixed range or price trigger, a slider for the band width, a choice of floor, paper or live, a name, and the money to give it.",
	},
] as const;

const ARROW =
	"flex size-10 items-center justify-center bg-white/[0.13] text-neutral-200 transition-colors enabled:hover:bg-white/[0.18] disabled:text-neutral-600";

export function Features() {
	const track = useRef<HTMLDivElement>(null);
	const [index, setIndex] = useState(0);

	// The count follows the scroll position, so a swipe, an arrow and the keyboard all agree.
	const follow = () => {
		const node = track.current;
		if (!node || node.clientWidth === 0) return;
		const next = Math.min(
			FEATURES.length - 1,
			Math.max(0, Math.round(node.scrollLeft / node.clientWidth)),
		);
		setIndex(next);
	};
	const go = (to: number) => {
		const node = track.current;
		if (!node) return;
		const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		node.scrollTo({ left: to * node.clientWidth, behavior: calm ? "auto" : "smooth" });
	};

	return (
		<section
			aria-label="Inside the app"
			aria-roledescription="carousel"
			className="relative bg-black px-(--gutter) pb-32"
		>
			<div className="mx-auto w-full max-w-[1240px]">
				<div aria-live="polite" className="text-left">
					<h3 className="font-display font-normal text-[clamp(1.75rem,3vw,2.75rem)] text-white leading-[1.08] tracking-[-0.02em] [text-wrap:balance]">
						{FEATURES[index]?.title}
					</h3>
					<p className="mt-4 max-w-[44ch] text-[clamp(1rem,1.2vw,1.125rem)] text-neutral-400 leading-snug">
						{FEATURES[index]?.line}
					</p>
				</div>
				<div className="mt-10">
					<Backdrop tone="silver">
						<div
							ref={track}
							data-track
							onScroll={follow}
							className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							{FEATURES.map((feature, position) => (
								<figure
									key={feature.name}
									aria-roledescription="slide"
									aria-label={`${position + 1} of ${FEATURES.length}`}
									className="shrink-0 basis-full snap-start"
								>
									<img
										src={`/showcase/feature-${feature.name}.jpg`}
										alt={feature.alt}
										width={2838}
										height={1800}
										loading="lazy"
										decoding="async"
										fetchPriority="low"
										className="block h-auto w-full shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)]"
									/>
								</figure>
							))}
						</div>
					</Backdrop>
				</div>
				<div className="mt-6 flex items-center justify-between">
					<span className="text-[13px] text-neutral-500 tabular-nums">
						{index + 1} / {FEATURES.length}
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							aria-label="Previous screen"
							disabled={index === 0}
							onClick={() => go(index - 1)}
							className={ARROW}
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 16 16"
								className="size-4 fill-none stroke-current stroke-[1.5]"
							>
								<path d="M10 3 5 8l5 5" />
							</svg>
						</button>
						<button
							type="button"
							aria-label="Next screen"
							disabled={index === FEATURES.length - 1}
							onClick={() => go(index + 1)}
							className={ARROW}
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 16 16"
								className="size-4 fill-none stroke-current stroke-[1.5]"
							>
								<path d="m6 3 5 5-5 5" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}
