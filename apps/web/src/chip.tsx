import {
	Code,
	Eye,
	Globe,
	ListChecks,
	type Icon as PhosphorIcon,
	Play,
	ShieldCheck,
	SlidersHorizontal,
} from "@phosphor-icons/react";

/** Each chapter of the front page story, with its own small Phosphor icon. */
const ICONS: Record<string, PhosphorIcon> = {
	start: Play,
	watch: Eye,
	limits: ShieldCheck,
	shape: SlidersHorizontal,
	proof: ListChecks,
	next: Globe,
	code: Code,
};

export type ChipIcon = "start" | "watch" | "limits" | "shape" | "proof" | "next" | "code";

/**
 * A chip: a tiny solid tag set above a section's headline that says where it is in the story. Small and flat, in
 * the pearl of the buttons with dark text, square, and never glass: no blur, no outline, no see-through fill. The icon is
 * decoration, so the word alone says it.
 */
export function SectionChip({
	icon,
	tone = "pearl",
	size = "small",
	className = "mb-5",
	children,
}: {
	/** The small icon for a chapter. Left out, the chip is just its word. */
	icon?: ChipIcon;
	/** `pearl` for the chapters; `dark` for the hero: near-black and opaque, with light text. */
	tone?: "pearl" | "dark";
	/** `small` for a chapter, `large` for the hero. */
	size?: "small" | "large";
	/** Its place on the page, such as the space under it. Left out, it sits just above a headline. */
	className?: string;
	children: React.ReactNode;
}) {
	const Icon = icon ? (ICONS[icon] ?? Play) : null;
	const colors =
		tone === "dark" ? "bg-neutral-900 text-neutral-200" : "bg-[oklch(0.93_0.02_300)] text-black";
	return (
		<span
			data-chip-tag
			className={`${className} inline-flex w-fit items-center font-medium ${size === "large" ? "h-7 gap-2 px-3.5 text-[13px]" : "h-5 gap-1.5 px-2.5 text-[11px]"} ${colors}`}
		>
			{Icon ? <Icon weight="bold" className="size-3" aria-hidden="true" /> : null}
			{children}
		</span>
	);
}
