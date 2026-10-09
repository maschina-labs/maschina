/**
 * A slanted band of light that sweeps across a button when it is hovered. The button holding it needs
 * `group relative overflow-hidden`. It is decoration, so assistive technology skips it, and anyone who asked
 * for less motion does not get it.
 */
export function Glint({ tone }: { tone: string }) {
	return (
		<span
			data-glint
			aria-hidden="true"
			className={`pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[420%] motion-reduce:hidden ${tone}`}
		/>
	);
}
