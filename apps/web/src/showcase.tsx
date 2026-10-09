/** A fine film grain, drawn by the browser from a tiny SVG filter: no image file to load, and nothing for the graphics card. */
const GRAIN =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * A real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 *
 * It floats in the middle of a backdrop of its own, a wide panel of soft pearl, violet and silver-blue light with
 * a fine grain, and room all around it. The backdrop is plain CSS (gradients and a grain filter), so it costs the
 * graphics card nothing, and it is where the page gets some color. The picture has an ordinary dark drop shadow
 * to lift it off the light, and nothing glows. It does not move with the scroll.
 */
export function Showcase() {
	return (
		<section aria-label="The app" className="relative bg-black px-(--gutter) pt-8 pb-24">
			<figure>
				<div
					data-backdrop
					className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_12%_8%,oklch(0.86_0.07_300),transparent_60%),radial-gradient(100%_80%_at_88%_18%,oklch(0.8_0.06_235),transparent_60%),radial-gradient(120%_100%_at_50%_105%,oklch(0.7_0.1_320),transparent_65%)] bg-[oklch(0.6_0.04_275)] p-[clamp(1.25rem,7vw,7rem)]"
				>
					<div
						data-grain
						aria-hidden="true"
						style={{ backgroundImage: GRAIN }}
						className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
					/>
					<img
						src="/showcase/dashboard.jpg"
						alt="The home screen of the Maschina app: a candlestick chart of SOL with a trade marked on it, a curve of realized profit, and tiles for the machine that is running, its latest decision, the vault balance and a new machine."
						width={2624}
						height={1640}
						decoding="async"
						className="relative block h-auto w-full shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)]"
					/>
				</div>
				<figcaption className="mt-5 text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
