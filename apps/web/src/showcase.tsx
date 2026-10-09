import { useRef } from "react";

/** A fine film grain, drawn by the browser from a tiny SVG filter: no image file to load, and nothing for the graphics card. */
const GRAIN =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * A real screenshot of the app, right under the hero: the dashboard home screen, with the chart, the machine
 * that is running, its latest decision and the vault. It is a still picture, taken from the app running locally
 * with its built-in sample data, so it says so under the picture; nothing here is a real person's trades or
 * results. Square corners, like everything else.
 *
 * It floats in the middle of a backdrop of its own, a wide panel of soft pearl and silver light with a fine
 * grain, and room all around it, in the quiet colors of the rest of the site. The backdrop is plain CSS
 * (gradients and a grain filter), so it costs the graphics card nothing. The picture has an ordinary dark drop
 * shadow to lift it off the light, and nothing glows.
 *
 * Under a mouse the picture leans lightly toward the cursor on both axes, so all four corners move (3 degrees at
 * most), and a lamp's light plays across it: a broad soft reflection that slides as it leans. It eases level when the cursor leaves. The cursor sets
 * a few variables straight on the element, so moving the mouse never re-renders anything. A finger and anyone
 * who asked for less motion get the still picture.
 */
export function Showcase() {
	const picture = useRef<HTMLDivElement>(null);

	const follow = (event: React.PointerEvent<HTMLElement>) => {
		const node = picture.current;
		if (!node || event.pointerType === "touch") return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const box = event.currentTarget.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) return;
		// How far across and down the backdrop the cursor is, from 0 to 1, however far it strays.
		const across = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
		const down = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
		node.style.setProperty("--tx", String(across * 2 - 1));
		node.style.setProperty("--ty", String(down * 2 - 1));
	};

	const level = () => {
		for (const name of ["--tx", "--ty"]) picture.current?.style.setProperty(name, "0");
	};

	return (
		<section aria-label="The app" className="relative bg-black px-(--gutter) pt-8 pb-24">
			<figure>
				<div
					data-backdrop
					onPointerMove={follow}
					onPointerLeave={level}
					className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_12%_8%,oklch(0.9_0.02_300),transparent_60%),radial-gradient(100%_80%_at_88%_18%,oklch(0.82_0.02_250),transparent_60%),radial-gradient(120%_100%_at_50%_105%,oklch(0.72_0.03_300),transparent_65%)] bg-[oklch(0.62_0.015_275)] p-[clamp(1.25rem,7vw,7rem)]"
				>
					<div
						data-grain
						aria-hidden="true"
						style={{ backgroundImage: GRAIN }}
						className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
					/>
					<div
						ref={picture}
						data-picture
						className="relative [--tx:0] [--ty:0] shadow-[0_30px_80px_-24px_oklch(0_0_0/0.65)] [transform:perspective(1400px)_rotateX(calc(var(--ty)*-3deg))_rotateY(calc(var(--tx)*3deg))] transition-transform duration-200 ease-out motion-reduce:transition-none"
					>
						<img
							src="/showcase/dashboard.jpg"
							alt="The home screen of the Maschina app: a candlestick chart of SOL with a trade marked on it, a curve of realized profit, and tiles for the machine that is running, its latest decision, the vault balance and a new machine."
							width={2624}
							height={1640}
							decoding="async"
							className="block h-auto w-full"
						/>
						{/*
						 * A lamp up and to the left, shining on the picture: a gentle falloff across all of it, and a
						 * broad soft band of reflected light that slides across as the picture leans, the way a
						 * reflection moves on glossy glass when it is tilted.
						 */}
						<div
							data-shine
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 overflow-hidden"
						>
							<div
								data-falloff
								className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-black/[0.1]"
							/>
							<div
								data-band
								className="absolute -inset-y-1/4 left-0 w-[70%] -skew-x-12 [background:linear-gradient(100deg,transparent,oklch(1_0_0/0.1)_50%,transparent)] [transform:translateX(calc(25%+var(--tx)*60%))] transition-transform duration-200 ease-out motion-reduce:transition-none"
							/>
						</div>
					</div>
				</div>
				<figcaption className="mt-5 text-center text-[13px] text-neutral-500">
					The Maschina app, shown with sample data.
				</figcaption>
			</figure>
		</section>
	);
}
