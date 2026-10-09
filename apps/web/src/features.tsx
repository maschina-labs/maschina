/**
 * Five real screens of the app, one section each: the words on one side, the screen large on the other, swapping
 * sides every time so the page reads down in a zigzag. The words stay left aligned inside their panel and the
 * section above them is centered, which keeps the page calm. Each section is a heading and one gray line, nothing
 * more. The screens come from the app running locally with its built-in sample data (the picture above says so);
 * nothing here is a real person's trades or results. Each picture runs to the edge of its panel, with no
 * outline. Square, still, and loaded only as you near them.
 */
const FEATURES = [
	{
		name: "portfolio",
		title: "See the whole portfolio at a glance.",
		line: "Profit over time, what is in play with your machines, and what the network fees came to.",
		alt: "The Portfolio screen of the Maschina app: a chart of profit over time, a card for realized profit, the amount in play with machines, and the fees paid.",
	},
	{
		name: "decisions",
		title: "Every decision is written down.",
		line: "A machine records what it decided and why before anything moves, and the ones the rules stopped are marked.",
		alt: "The Decisions screen of the Maschina app: a list of each decision with its time, the machine, and why, beside counts of trades set out, stopped by the rules, and waited on.",
	},
	{
		name: "activity",
		title: "Everything it does, in order.",
		line: "Each trade, each refusal and each time it chose to wait, with the whole record available as a spreadsheet.",
		alt: "The Activity screen of the Maschina app: recent events, counts for the week, the busiest machine, and links to every trade, every decision and an export.",
	},
	{
		name: "insights",
		title: "Know how it is really doing.",
		line: "Notes on each machine, how close its fills land to the quote, and how it compares with simply holding.",
		alt: "The Insights screen of the Maschina app: notes on a machine, execution against the quote, the result against holding, the largest drop, the win rate and fees.",
	},
	{
		name: "manager",
		title: "Ask your manager.",
		line: "Ask about your machines, the market or what to do next, with your machines listed beside the chat.",
		alt: "The Manager screen of the Maschina app: a chat to ask about your machines, a list of them on the left, and a paper trader with its worth, cash and recent decisions on the right.",
	},
] as const;

export function Features() {
	return (
		<section
			aria-label="Inside the app"
			className="relative flex flex-col gap-3 bg-black px-(--gutter) pb-32"
		>
			{FEATURES.map((feature, index) => (
				<article
					key={feature.name}
					className={`grid items-center gap-0 bg-white/[0.04] ${index % 2 === 0 ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}
				>
					<div
						className={`p-[clamp(1.5rem,4vw,4rem)] ${index % 2 === 0 ? "lg:order-1" : "lg:order-2"}`}
					>
						<h3 className="font-display font-normal text-[clamp(1.75rem,3vw,2.75rem)] text-white leading-[1.08] tracking-[-0.02em] [text-wrap:balance]">
							{feature.title}
						</h3>
						<p className="mt-5 max-w-[34ch] text-[clamp(1rem,1.2vw,1.125rem)] text-neutral-400 leading-snug">
							{feature.line}
						</p>
					</div>
					<div className={index % 2 === 0 ? "lg:order-2" : "lg:order-1"}>
						<img
							src={`/showcase/feature-${feature.name}.jpg`}
							alt={feature.alt}
							width={2400}
							height={1500}
							loading="lazy"
							decoding="async"
							fetchPriority="low"
							className="block h-auto w-full"
						/>
					</div>
				</article>
			))}
		</section>
	);
}
