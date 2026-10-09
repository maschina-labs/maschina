/**
 * The main call to action: the pearl button with a small square black chip inset beside the words, an arrow
 * pointing up and to the right in white. The chip is smaller than the button, so pearl shows all around it.
 * It is part of the link, so the whole thing is one click, and the arrow is decoration (the name stays
 * "Try Maschina").
 */
export function TryButton({
	href,
	className,
	labelClassName,
	chipClassName,
}: {
	href: string;
	className: string;
	labelClassName: string;
	chipClassName: string;
}) {
	return (
		<a
			href={href}
			className={`items-center gap-3 bg-[oklch(0.93_0.02_300)] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] ${className}`}
		>
			<span className={labelClassName}>Try Maschina</span>
			<span data-chip className={`grid place-items-center bg-black text-white ${chipClassName}`}>
				<svg
					viewBox="0 0 12 12"
					className="size-3"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					strokeLinecap="square"
					aria-hidden="true"
				>
					<path d="M3 9l6-6M4 3h5v5" />
				</svg>
			</span>
		</a>
	);
}
