import { useEffect, useRef } from "react";

/**
 * A real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 *
 * It sits in a light square frame so it stands out from the black. As the page scrolls it tilts in: leaned back
 * while it is still below the fold, and flat by the time it is well into view. The lean is one variable, set
 * straight on the element as the page scrolls, so scrolling never re-renders anything. It does not tilt for
 * anyone who asked for less motion.
 */
export function Showcase() {
	const tilt = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const update = () => {
			const node = tilt.current;
			if (!node) return;
			const height = window.innerHeight;
			// Fully leaned back when its top is at the bottom of the screen, flat once it is 15% from the top.
			const amount = (node.getBoundingClientRect().top - height * 0.15) / (height * 0.85);
			node.style.setProperty("--tilt", String(Math.min(1, Math.max(0, amount))));
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return (
		<section aria-label="The app" className="relative bg-black px-(--gutter) pt-8 pb-24">
			<figure>
				<div
					ref={tilt}
					data-tilt
					className="origin-bottom [--tilt:0] [transform:perspective(1600px)_rotateX(calc(var(--tilt)*6deg))_scale(calc(1-var(--tilt)*0.03))] will-change-transform"
				>
					<div data-frame className="bg-white/[0.18] p-0.5">
						<img
							src="/showcase/dashboard.jpg"
							alt="The home screen of the Maschina app: a candlestick chart of SOL with a trade marked on it, a curve of realized profit, and tiles for the machine that is running, its latest decision, the vault balance and a new machine."
							width={2624}
							height={1640}
							decoding="async"
							className="block h-auto w-full"
						/>
					</div>
				</div>
				<figcaption className="mt-5 text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
