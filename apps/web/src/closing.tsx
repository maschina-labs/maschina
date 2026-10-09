/**
 * The section under the hero, dark like the page. It sits above the hero, which stays pinned, so it rolls up
 * over it as the page scrolls. It is empty for now: the particles that were here were too heavy on the
 * graphics card (the last version is in the history), and what goes here instead is still to be worked out.
 */
export function Closing() {
	return (
		<section
			aria-label="Get started"
			className="relative z-10 min-h-[80dvh] bg-black px-(--gutter) py-24"
		/>
	);
}
