import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

/**
 * A button.
 *
 * Five variants, and each one means something rather than looking like something.
 * `danger` is not "red button", it is an action that cannot be undone, and using
 * it for anything reversible is what makes people stop reading them.
 */
const button = cva(
	"inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
	{
		variants: {
			variant: {
				primary: "bg-accent text-ground hover:bg-accent/90",
				default: "bg-raised text-ink border border-line hover:border-line-strong",
				quiet: "text-ink-dim hover:text-ink hover:bg-raised",
				// Destructive and irreversible. Revoking, stopping, deleting.
				danger: "bg-bad/12 text-bad border border-bad/35 hover:bg-bad/20",
				link: "text-accent underline-offset-2 hover:underline",
			},
			size: {
				sm: "h-6 px-2 text-2xs",
				md: "h-7 px-2.5 text-xs",
				lg: "h-9 px-4 text-sm",
			},
		},
		defaultVariants: { variant: "default", size: "md" },
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof button> {}

export function Button({ className, variant, size, type, ...rest }: ButtonProps) {
	// Defaulted, because a button inside a form with no type submits it, and that
	// has surprised somebody in every codebase that did not do this.
	return (
		<button
			type={type ?? "button"}
			className={cn(button({ variant, size }), className)}
			{...rest}
		/>
	);
}

export { button as buttonVariants };
