import { useRef } from "react";
import { WORDMARK } from "./wordmark.ts";

/** How much of the wordmark shows above the bottom of the page: about three quarters of the letters. */
const SHOWN = 116;
/** How far the light from the cursor reaches, in the drawing's own units. */
const REACH = 260;

const VIEW = {
	x: WORDMARK.left,
	y: 0,
	width: WORDMARK.width - WORDMARK.left,
	height: WORDMARK.height,
};

/**
 * The wordmark as thin outlines, filled with the page's own black. It is drawn twice: once in faint grey,
 * once in pearl, and the pearl one shows only through a soft circle that follows the cursor.
 */
function Outline({ stroke }: { stroke: string }) {
	return (
		<g data-layer>
			{WORDMARK.paths.map((d) => (
				<path
					key={d}
					d={d}
					fill="black"
					stroke={stroke}
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</g>
	);
}

export function Footer() {
	const spot = useRef<SVGCircleElement>(null);
	const lit = useRef<SVGGElement>(null);

	// The light moves by setting attributes directly: following the cursor never re-renders the page.
	const follow = (event: React.PointerEvent<SVGSVGElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const x = VIEW.x + ((event.clientX - box.left) / box.width) * VIEW.width;
		const y = VIEW.y + ((event.clientY - box.top) / box.height) * VIEW.height;
		spot.current?.setAttribute("cx", String(x));
		spot.current?.setAttribute("cy", String(y));
		if (lit.current) lit.current.style.opacity = "1";
	};
	const leave = () => {
		if (lit.current) lit.current.style.opacity = "0";
	};

	return (
		<footer className="relative w-full overflow-hidden px-6 sm:px-[4vw]">
			<p className="pb-6 text-[13px] text-neutral-500">
				© {new Date().getFullYear()} Maschina Labs. All rights reserved.
			</p>
			<div style={{ aspectRatio: `${VIEW.width} / ${SHOWN}` }} className="relative">
				<svg
					role="img"
					aria-label="Maschina"
					viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
					className="absolute inset-x-0 top-0 h-auto w-full"
					onPointerMove={follow}
					onPointerLeave={leave}
				>
					<defs>
						<linearGradient
							id="pearl"
							x1={WORDMARK.left}
							y1="0"
							x2={WORDMARK.width}
							y2="0"
							gradientUnits="userSpaceOnUse"
						>
							{/* Silver and pearl, the theme's own hues (the field's city palette), brighter for a hairline. */}
							<stop offset="0" stopColor="oklch(0.84 0.025 260)" />
							<stop offset="0.35" stopColor="oklch(0.96 0.03 300)" />
							<stop offset="0.65" stopColor="oklch(0.88 0.04 325)" />
							<stop offset="1" stopColor="oklch(0.9 0.03 285)" />
						</linearGradient>
						<radialGradient id="spot-fade">
							<stop offset="0" stopColor="white" />
							<stop offset="1" stopColor="black" />
						</radialGradient>
						<mask id="spot" maskUnits="userSpaceOnUse" {...VIEW}>
							<circle
								ref={spot}
								data-spot
								cx={-REACH * 2}
								cy={-REACH * 2}
								r={REACH}
								fill="url(#spot-fade)"
							/>
						</mask>
					</defs>
					<Outline stroke="oklch(1 0 0 / 0.16)" />
					<g
						ref={lit}
						data-lit
						mask="url(#spot)"
						style={{ opacity: 0 }}
						className="transition-opacity duration-500"
					>
						<Outline stroke="url(#pearl)" />
					</g>
				</svg>
			</div>
		</footer>
	);
}
