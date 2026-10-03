/**
 * Pebbled glass: the city behind seen through a pane of small rounded bumps, each bending the light a
 * little and catching a faint highlight, as bathroom glass does. Only the city is bent; the tiles in
 * front stay perfectly sharp. Drawn by the browser's own filters, so it costs next to nothing.
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
				{/* The pebbles: soft round bumps, a few dozen pixels across. */}
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.018"
					numOctaves="2"
					seed="7"
					result="bumps"
				/>
				<feGaussianBlur in="bumps" stdDeviation="2.2" result="smooth" />
				{/* Each bump bends what is behind it. */}
				<feDisplacementMap
					in="SourceGraphic"
					in2="smooth"
					scale="34"
					xChannelSelector="R"
					yChannelSelector="G"
					result="bent"
				/>
				{/* And catches a little light on its upper edge. */}
				<feSpecularLighting
					in="smooth"
					surfaceScale="3.2"
					specularConstant="0.55"
					specularExponent="22"
					lightingColor="#ffffff"
					result="sheen"
				>
					<feDistantLight azimuth="235" elevation="52" />
				</feSpecularLighting>
				<feComposite in="sheen" in2="SourceGraphic" operator="in" result="sheenOnGlass" />
				<feComposite
					in="bent"
					in2="sheenOnGlass"
					operator="arithmetic"
					k1="0"
					k2="1"
					k3="0.16"
					k4="0"
				/>
			</filter>
		</svg>
	);
}
