import { Glint } from "./glint.tsx";

/**
 * The main call to action: the pearl button with a small square black chip inset beside the words, a chevron
 * pointing right in white. The chip is smaller than the button, so pearl shows all around it.
 * It is part of the link, so the whole thing is one click, and the chevron is decoration (the name is just the
 * words, "Try Maschina" unless another label is given).
 */
export function TryButton({
	href,
	className,
	labelClassName,
	chipClassName,
	label = "Try Maschina",
	glint = false,
}: {
	href: string;
	className: string;
	labelClassName: string;
	chipClassName: string;
	label?: string;
	/** A sweep of light on hover. */
	glint?: boolean;
}) {
	return (
		<a
			href={href}
			className={`items-center gap-3 bg-[linear-gradient(135deg,oklch(0.8_0.02_270),oklch(0.95_0.02_300)_50%,oklch(0.82_0.025_280))] text-black transition-[filter] hover:brightness-105 ${glint ? "group relative overflow-hidden " : ""}${className}`}
		>
			<span className={labelClassName}>{label}</span>
			{glint ? <Glint tone="via-white" /> : null}
			<span
				data-chip
				className={`relative z-10 grid place-items-center bg-black text-white ${chipClassName}`}
			>
				<svg
					viewBox="0 0 12 12"
					className="size-3"
					data-arrow="chevron"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					strokeLinecap="square"
					aria-hidden="true"
				>
					<path d="M4.5 2.5 8 6 4.5 9.5" />
				</svg>
			</span>
		</a>
	);
}
