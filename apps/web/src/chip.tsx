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
 * A chapter chip: a tiny solid tag set above a section's headline that says where it is in the story. Small and flat, in
 * the pearl of the buttons with dark text, square, and never glass: no blur, no outline, no see-through fill. The icon is
 * decoration, so the word alone says it.
 */
export function SectionChip({ icon, children }: { icon: ChipIcon; children: React.ReactNode }) {
	const Icon = ICONS[icon] ?? Play;
	return (
		<span
			data-chip-tag
			className="mb-5 inline-flex h-5 w-fit items-center gap-1 bg-[oklch(0.93_0.02_300)] px-1.5 font-medium text-[11px] text-black"
		>
			<Icon weight="bold" className="size-3" aria-hidden="true" />
			{children}
		</span>
	);
}
