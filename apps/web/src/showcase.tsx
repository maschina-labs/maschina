import { Backdrop } from "./backdrop.tsx";

/**
 * A short title, then a real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 *
 * It floats in the middle of a backdrop of its own, a wide panel of soft pearl and silver light with a fine
 * grain, and room all around it, in the quiet colors of the rest of the site. The backdrop is plain CSS
 * (gradients and a grain filter), so it costs the graphics card nothing. The picture has an ordinary dark drop
 * shadow to lift it off the light, and nothing glows. Nothing moves: no tilt, no shine, no window frame.
 *
 * On a phone the backdrop starts under the left edge of the title (a line of it is about 11.6rem wide, centered) and runs out
 * to the edge of the screen at the right, and the picture
 * is three and two tenths times as wide as the room it has, so the app is big enough to read, with its whole height,
 * cut off at the right like the backdrop. The backdrop swipes sideways to show the rest of it.
 *
 * The picture is very sharp: it is the whole app, edge to edge, captured on a 1920 by 1200 screen at three times its
 * pixels, and the browser picks between a 2838 pixel file and a 5676 pixel one for the screen it is on.
 */
export function Showcase() {
	return (
		<section
			aria-label="The app"
			className="relative flex flex-col items-center bg-black px-(--gutter) pt-8 pb-12"
		>
			<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				Everything in one place.
			</h2>
			<figure className="mt-16 w-full">
				<Backdrop className="max-sm:-mr-(--gutter) max-sm:ml-[calc((100%-11.6rem)/2)] max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
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
						className="relative block h-auto w-full max-sm:w-[320%] max-sm:max-w-none shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)]"
					/>
				</Backdrop>
				<figcaption className="mt-5 text-center text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
