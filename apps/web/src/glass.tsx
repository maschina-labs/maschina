/**
 * Two pieces the text pages share, so they look like one site: the glass a picture sits on (a faint fill and a thin
 * pearl outline, the footer wordmark's look) and the small pearl chip with an arrow that says a thing can be opened.
 */
export const PANEL =
	"bg-white/[0.03] outline outline-1 outline-white/[0.12] shadow-[0_0_80px_oklch(0.93_0.02_300/0.05)]";

/** A pearl square with a black arrow, or a black one with a white arrow for use on pearl. It is decoration: the words beside it say what it is. */
export function ArrowChip({
	className = "",
	tone = "pearl",
	direction = "out",
}: {
	className?: string;
	tone?: "pearl" | "black";
	/** `out` points up and to the right, for something that opens; `next` is the chevron the site's other buttons carry. */
	direction?: "out" | "next";
}) {
	return (
		<span
			data-chip
			aria-hidden="true"
			className={`grid size-8 shrink-0 place-items-center ${tone === "pearl" ? "bg-[oklch(0.93_0.02_300)] text-black" : "bg-black text-white"} ${className}`}
		>
			<svg
				aria-hidden="true"
				data-icon="arrow"
				viewBox="0 0 12 12"
				className="size-3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="square"
			>
				<path d={direction === "out" ? "M3 9 9 3M4 3h5v5" : "M4.5 2.5 8 6l-3.5 3.5"} />
			</svg>
		</span>
	);
}
