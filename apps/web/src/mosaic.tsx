import { Backdrop } from "./backdrop.tsx";

/**
 * Five real screens of the app in a mosaic, right after the dashboard: one big tile and four small ones, each
 * named bottom-left over a soft dark fade, and nothing else on them. They sit on the same pearl and silver backdrop as
 * the dashboard image, since dark screens on a black page would vanish. The pictures do the explaining. They were
 * taken from the app running locally with its built-in sample data, so it says so under the grid; nothing here is a
 * real person's trades or results. Every tile is the same shape (the big one is two small ones wide and tall), and
 * the corners are square. The pictures are large and sit below the first screen, so they load only as you near them.
 */
const TILES = [
	{ name: "Portfolio", width: 2400, height: 1522, big: true },
	{ name: "Decisions", width: 1400, height: 888, big: false },
	{ name: "Activity", width: 1400, height: 888, big: false },
	{ name: "Insights", width: 1400, height: 888, big: false },
	{ name: "Manager", width: 1400, height: 888, big: false },
] as const;

const ALT: Record<(typeof TILES)[number]["name"], string> = {
	Portfolio:
		"The Portfolio screen of the Maschina app: a chart of profit over time, what is in play with the machines, and the fees paid.",
	Decisions:
		"The Decisions screen of the Maschina app: a list of each decision a machine made, with the ones the rules stopped marked as refused.",
	Activity:
		"The Activity screen of the Maschina app: recent events, counts for the week, and links to every trade and every decision.",
	Insights:
		"The Insights screen of the Maschina app: notes on a machine and a few measures of how it has done.",
	Manager:
		"The Manager screen of the Maschina app: a chat to ask about your machines, with a list of them and a paper trader beside it.",
};

export function Mosaic() {
	return (
		<section
			aria-label="Inside the app"
			className="relative flex flex-col items-center bg-black px-(--gutter) py-32"
		>
			<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				Everything in one place.
			</h2>
			<div className="mt-16 w-full">
				<Backdrop>
					<div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
						{TILES.map((tile) => (
							<figure
								key={tile.name}
								className={`relative overflow-hidden bg-white/[0.04] shadow-[0_24px_60px_-24px_oklch(0_0_0/0.6)] ${
									tile.big ? "col-span-2 row-span-2 aspect-[16/10]" : "aspect-[16/10]"
								}`}
							>
								<img
									src={`/showcase/mosaic-${tile.name.toLowerCase()}.jpg`}
									alt={ALT[tile.name]}
									width={tile.width}
									height={tile.height}
									loading="lazy"
									decoding="async"
									fetchPriority="low"
									className="block size-full object-cover"
								/>
								<figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 text-[clamp(1.125rem,1.8vw,1.5rem)] text-white tracking-[-0.01em] sm:p-6 sm:pt-20">
									{tile.name}
								</figcaption>
							</figure>
						))}
					</div>
				</Backdrop>
			</div>
			<p className="mt-8 text-center text-[13px] text-neutral-500">
				The Maschina app, shown with sample data.
			</p>
		</section>
	);
}
