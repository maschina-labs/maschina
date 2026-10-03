/**
 * Textured glass: the city behind seen through frosted, stippled glass. A fine grain bends the light a
 * little everywhere, softens it slightly, and catches small glints where the light behind is bright, the
 * way light sparkles on the grain of a frosted window. Only the city is textured; the tiles in front stay
 * perfectly sharp. Drawn by the browser's own filters, so it costs next to nothing.
 */
export function PebbledGlassFilter() {
	return (
		<svg aria-hidden="true" width="0" height="0" className="pointer-events-none fixed">
			<filter
				id="pebbled"
				x="-4%"
				y="-4%"
				width="108%"
				height="108%"
				colorInterpolationFilters="sRGB"
			>
				{/* The grain: a few pixels across, close enough to see each bead. */}
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.42"
					numOctaves="2"
					seed="11"
					result="grain"
				/>
				{/* Frost: the light behind softened a little before the grain bends it. */}
				<feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="frosted" />
				<feDisplacementMap
					in="frosted"
					in2="grain"
					scale="16"
					xChannelSelector="R"
					yChannelSelector="G"
					result="bent"
				/>
				{/* Glints on the grain, lit from the upper left. */}
				<feSpecularLighting
					in="grain"
					surfaceScale="1.6"
					specularConstant="0.9"
					specularExponent="28"
					lightingColor="#ffffff"
					result="glints"
				>
					<feDistantLight azimuth="225" elevation="48" />
				</feSpecularLighting>
				{/* Strongest where the light behind is brightest, as on real frosted glass. */}
				<feColorMatrix
					in="SourceGraphic"
					type="matrix"
					values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 1.6 0.4 0 -0.12"
					result="bright"
				/>
				<feComposite in="glints" in2="bright" operator="in" result="lit" />
				<feComposite in="bent" in2="lit" operator="arithmetic" k1="0" k2="1" k3="0.32" k4="0" />
			</filter>
		</svg>
	);
}
