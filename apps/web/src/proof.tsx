/**
 * The section under the hero, in pearl white. It starts below the first screen, sits above the hero (which
 * stays pinned), and so rolls over it as the page scrolls. Its content comes later, one piece at a time.
 */
export function Proof() {
	return (
		<section
			aria-label="Proof"
			className="relative z-10 min-h-dvh bg-[oklch(0.95_0.012_300)] px-(--gutter) py-20"
		/>
	);
}
