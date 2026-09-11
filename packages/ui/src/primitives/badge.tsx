import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

/**
 * A state, said in one word.
 *
 * The tones map to meaning and not to preference: `bad` is a failure or a denial,
 * `warn` is something waiting on a person, `good` is finished and verified. A
 * state with no tone is neutral on purpose rather than undecided.
 */
const badge = cva(
	"inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs leading-none",
	{
		variants: {
			tone: {
				neutral: "bg-ground text-ink-faint",
				accent: "bg-accent/15 text-accent",
				good: "bg-good/15 text-good",
				warn: "bg-warn/15 text-warn",
				bad: "bg-bad/15 text-bad",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);

export interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badge> {}

export function Badge({ className, tone, ...rest }: BadgeProps) {
	return <span className={cn(badge({ tone }), className)} {...rest} />;
}
