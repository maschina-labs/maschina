import { Glint } from "./glint.tsx";

/** The two looks: pearl for dark backgrounds, and black for light ones, where pearl would vanish. */
const LOOK = {
	pearl: {
		button:
			"bg-[oklch(0.93_0.02_300)] text-black shadow-[inset_0_0_0_1px_oklch(1_0_0/0.95),0_0_0_1px_oklch(0.74_0.035_290/0.8)] hover:bg-[oklch(0.98_0.015_300)]",
		chip: "bg-black text-white",
		glint:
			"bg-[linear-gradient(90deg,transparent,oklch(0.78_0.04_290/0.5)_36%,oklch(1_0_0)_50%,oklch(0.78_0.04_290/0.5)_64%,transparent)]",
	},
	dark: {
		button:
			"bg-black text-white shadow-[inset_0_0_0_1px_oklch(1_0_0/0.18),0_0_0_1px_oklch(0.3_0.01_285)] hover:bg-[oklch(0.2_0.01_285)]",
		chip: "bg-[oklch(0.93_0.02_300)] text-black",
		glint: "bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.35)_50%,transparent)]",
	},
} as const;

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
	tone = "pearl",
}: {
	href: string;
	className: string;
	labelClassName: string;
	chipClassName: string;
	label?: string;
	/** A sweep of light on hover. */
	glint?: boolean;
	/** Pearl on a dark page, black on a light one. */
	tone?: "pearl" | "dark";
}) {
	const look = LOOK[tone];
	return (
		<a
			href={href}
			className={`items-center gap-3 transition-colors ${look.button} ${glint ? "group relative overflow-hidden " : ""}${className}`}
		>
			<span className={labelClassName}>{label}</span>
			{glint ? <Glint tone={look.glint} /> : null}
			<span
				data-chip
				className={`relative z-10 grid place-items-center ${look.chip} ${chipClassName}`}
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
