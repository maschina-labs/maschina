import { Backdrop } from "./backdrop.tsx";

/**
 * A real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 *
 * It floats in the middle of a backdrop of its own, a wide panel of soft pearl and silver light with a fine
 * grain, and room all around it, in the quiet colors of the rest of the site. The backdrop is plain CSS
 * (gradients and a grain filter), so it costs the graphics card nothing. The picture has an ordinary dark drop
 * shadow to lift it off the light, and nothing glows. Nothing moves: no tilt, no shine, no window frame.
 *
 * The picture is very sharp: it is the whole app, edge to edge, captured on a 1920 by 1200 screen at three times its
 * pixels, and the browser picks between a 2838 pixel file and a 5676 pixel one for the screen it is on.
 */
export function Showcase() {
	return (
		<section aria-label="The app" className="relative bg-black px-(--gutter) pt-8 pb-24">
			<figure>
				<Backdrop>
					<img
						src="/showcase/dashboard.jpg"
						srcSet="/showcase/dashboard.jpg 2838w, /showcase/dashboard-4x.jpg 5676w"
						sizes="(min-width: 1536px) 1300px, (min-width: 1280px) 900px, 82vw"
						alt="The home screen of the Maschina app, shown full screen: a candlestick chart of SOL with a trade marked on it, a curve of realized profit, and tiles for the machine that is running, its latest decision, the vault balance and a new machine."
						width={2838}
						height={1800}
						decoding="async"
						loading="lazy"
						fetchPriority="low"
						className="relative block h-auto w-full shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)]"
					/>
				</Backdrop>
				<figcaption className="mt-5 text-center text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
