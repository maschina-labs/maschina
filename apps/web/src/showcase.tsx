/**
 * A real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 */
export function Showcase() {
	return (
		<section aria-label="The app" className="relative bg-black px-(--gutter) pt-8 pb-24">
			<figure>
				<img
					src="/showcase/dashboard.jpg"
					alt="The home screen of the Maschina app: a candlestick chart of SOL with a trade marked on it, a curve of realized profit, and tiles for the machine that is running, its latest decision, the vault balance and a new machine."
					width={2624}
					height={1640}
					decoding="async"
					className="block h-auto w-full shadow-[0_60px_140px_-50px_oklch(0.85_0.04_285/0.28)]"
				/>
				<figcaption className="mt-5 text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
