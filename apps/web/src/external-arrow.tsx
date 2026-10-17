import { ArrowUpRight } from "@phosphor-icons/react";

/**
 * The small up-right arrow that says a link leaves the site: it goes to another address. It takes its color from the link, so it is gray with the words and light with them on hover.
 */
export function ExternalArrow() {
	return (
		<ArrowUpRight
			weight="regular"
			data-arrow="external"
			className="ml-1.5 inline size-3"
			aria-hidden="true"
		/>
	);
}
