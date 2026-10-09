import { Mesh, Particles, RibbonWhenNear } from "./backgrounds.tsx";

/**
 * The app, one full page at a time: a heading and one gray line, then the whole screen, uncropped and as large as
 * the page allows, floating over a background of its own. Each section has a different kind of background (a
 * mesh, particles, the ribbon, another mesh) so no two neighbors look alike, and every background fades out at
 * the top and bottom so the sections melt into each other. The words alternate between left aligned and
 * centered. The screens come from the app running locally with its built-in sample data (the picture above says
 * so); nothing here is a real person's trades or results. Nothing is boxed in a panel or outlined. Square, and the
 * pictures load only as you near them.
 *
 * The last section is about making it yours. What exists today is each machine's range, amount, slippage and
 * spending limits; rearranging your own screens and tiles is not built, and it says so.
 */
const FEATURES = [
	{
		name: "portfolio",
		title: "See the whole portfolio at a glance.",
		line: "Profit over time, what is in play with your machines, and what the network fees came to.",
		alt: "The Portfolio screen of the Maschina app: a chart of profit over time, a card for realized profit, the amount in play with machines, and the fees paid.",
		background: <Mesh tone="pearl" />,
		kind: "mesh",
	},
	{
		name: "decisions",
		title: "Every decision is written down.",
		line: "A machine records what it decided and why before anything moves, and the ones the rules stopped are marked.",
		alt: "The Decisions screen of the Maschina app: a list of each decision with its time, the machine, and why, beside counts of trades set out, stopped by the rules, and waited on.",
		background: <Particles />,
		kind: "particles",
	},
	{
		name: "manager",
		title: "Ask your manager.",
		line: "Ask about your machines, the market or what to do next, with your machines listed beside the chat.",
		alt: "The Manager screen of the Maschina app: a chat to ask about your machines, a list of them on the left, and a paper trader with its worth, cash and recent decisions on the right.",
		background: <RibbonWhenNear />,
		kind: "ribbon",
	},
	{
		name: "machines",
		title: "Make it yours.",
		line: "Set every limit on a machine yourself. Rearranging your own screens and tiles is coming soon.",
		alt: "The Machines screen of the Maschina app: a card for each machine with its state, trades and result, and a card to give a machine a new job.",
		background: <Mesh tone="silver" />,
		kind: "mesh",
	},
] as const;

export function Features() {
	return (
		<section aria-label="Inside the app" className="relative bg-black">
			{FEATURES.map((feature, index) => (
				<article
					key={feature.name}
					className="relative flex min-h-dvh flex-col items-center justify-center gap-14 overflow-hidden px-(--gutter) py-24"
				>
					<div
						data-background={feature.kind}
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]"
					>
						{feature.background}
					</div>
					<div
						className={`relative w-full max-w-[1240px] ${index % 2 === 0 ? "text-left" : "text-center"}`}
					>
						<h3 className="font-display font-normal text-[clamp(1.75rem,3vw,2.75rem)] text-white leading-[1.08] tracking-[-0.02em] [text-wrap:balance]">
							{feature.title}
						</h3>
						<p
							className={`mt-5 max-w-[40ch] text-[clamp(1rem,1.2vw,1.125rem)] text-neutral-400 leading-snug ${index % 2 === 0 ? "" : "mx-auto"}`}
						>
							{feature.line}
						</p>
					</div>
					<img
						src={`/showcase/feature-${feature.name}.jpg`}
						alt={feature.alt}
						width={2400}
						height={1500}
						loading="lazy"
						decoding="async"
						fetchPriority="low"
						className="relative block h-auto w-full max-w-[1240px] shadow-[0_40px_120px_-30px_oklch(0_0_0/0.8)]"
					/>
				</article>
			))}
		</section>
	);
}
