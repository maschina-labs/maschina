/**
 * The fogged window, in two parts. The smoke darkens the field so the light behind only just comes
 * through; it sits under everything. The grain sits over everything, header included, like grain on
 * film: it is the frosted texture, and it breaks up the steps a smooth dark fade shows on a screen.
 *
 * Neither blurs. The field is already soft, and a blur over it only added dark rims at the edges of
 * whatever was laid on top.
 */

// Fractal noise, drawn once by the browser from this tiny SVG and tiled.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

/** Smoke in the dark, frost in the light: the same window, laid over the field either way. */
export function FoggedGlass({ mode = "dark" }: { mode?: "dark" | "light" }) {
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none fixed inset-0 z-0 ${mode === "light" ? "bg-white/40" : "bg-black/55"}`}
		/>
	);
}

export function Grain() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 z-50 opacity-[0.14] mix-blend-overlay"
			style={{ backgroundImage: GRAIN }}
		/>
	);
}
