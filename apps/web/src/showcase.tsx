import { Backdrop } from "./backdrop.tsx";
import { useMessages } from "./i18n/use-messages.ts";

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
 * On a phone the backdrop starts at the page margin on the left and runs out to the edge of the screen at the right, and the
 * picture is three and two tenths times as wide as the room it has, so the app is big enough to read, with its whole
 * height, cut off at the right like the backdrop. The backdrop swipes sideways to show the rest of it.
 *
 * The picture is very sharp: it is the whole app, edge to edge, captured on a 1920 by 1200 screen at three times its
 * pixels, and the browser picks between a 2838 pixel file and a 5676 pixel one for the screen it is on.
 */
export function Showcase() {
	const m = useMessages().home.showcase;
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative flex flex-col items-center bg-black px-(--gutter) pt-12 pb-12 sm:pt-16 sm:pb-16"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative flex w-full min-w-0 flex-col items-center px-4 sm:px-8 lg:px-12">
				<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
					{m.title}
				</h2>
				<figure className="mt-12 w-full max-w-[76rem] sm:mt-16">
					<Backdrop className="max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
						<picture>
							<source
								type="image/avif"
								srcSet="/showcase/dashboard.avif 2838w, /showcase/dashboard-4x.avif 5676w"
								sizes="(min-width: 1536px) 1300px, (min-width: 1280px) 900px, 82vw"
							/>
							<img
								src="/showcase/dashboard.jpg"
								srcSet="/showcase/dashboard.jpg 2838w, /showcase/dashboard-4x.jpg 5676w"
								sizes="(min-width: 1536px) 1300px, (min-width: 1280px) 900px, 82vw"
								alt={m.alt}
								width={2838}
								height={1800}
								decoding="async"
								loading="lazy"
								fetchPriority="low"
								className="relative block h-auto w-full max-sm:w-[320%] max-sm:max-w-none shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)]"
							/>
						</picture>
					</Backdrop>
					<figcaption className="mt-5 text-center text-[13px] text-neutral-500">
						{m.caption}
					</figcaption>
				</figure>
			</div>
		</section>
	);
}
