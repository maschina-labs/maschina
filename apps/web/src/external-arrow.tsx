/**
 * The small up-right arrow that says a link leaves the site: it goes to another address, or to a plain file that is not
 * a page of it. It takes its color from the link, so it is gray with the words and light with them on hover.
 */
export function ExternalArrow() {
	return (
		<svg
			viewBox="0 0 12 12"
			data-arrow="external"
			className="ml-1.5 inline size-3"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.25}
			strokeLinecap="square"
			aria-hidden="true"
		>
			<path d="M3.5 8.5 8.5 3.5M4 3.5h4.5V8" />
		</svg>
	);
}
