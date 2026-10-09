/** A fine film grain, drawn by the browser from a tiny SVG filter: no image file to load, and nothing for the graphics card. */
const GRAIN =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * A wide panel of soft pearl and silver light with a fine grain and room all around, in the quiet colors of the
 * rest of the site, for the app's dark screens to sit on so they stand out from the black. It is plain CSS (gradients
 * and a grain filter), so it costs the graphics card nothing. What goes inside needs to be `relative`, to sit above
 * the grain.
 */
export function Backdrop({ children }: { children: React.ReactNode }) {
	return (
		<div
			data-backdrop
			className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_12%_8%,oklch(0.9_0.02_300),transparent_60%),radial-gradient(100%_80%_at_88%_18%,oklch(0.82_0.02_250),transparent_60%),radial-gradient(120%_100%_at_50%_105%,oklch(0.72_0.03_300),transparent_65%)] bg-[oklch(0.62_0.015_275)] p-[clamp(1.25rem,7vw,7rem)]"
		>
			<div
				data-grain
				aria-hidden="true"
				style={{ backgroundImage: GRAIN }}
				className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
			/>
			{children}
		</div>
	);
}
