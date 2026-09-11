import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * Something went wrong, or is about to.
 *
 * A notice, never a disappearing toast. A window that reports a lost connection
 * in a toast that fades after four seconds has told nobody anything, and losing
 * the control plane is indistinguishable from nothing having happened unless the
 * message stays on screen (`08-ENVIRONMENT` §1).
 */
export function Notice({
	title,
	tone = "bad",
	children,
	className,
}: {
	readonly title: string;
	readonly tone?: "bad" | "warn" | "accent";
	readonly children: ReactNode;
	readonly className?: string;
}) {
	const tones = {
		bad: "border-bad/45 bg-bad/8 text-bad",
		warn: "border-warn/45 bg-warn/8 text-warn",
		accent: "border-accent/45 bg-accent/8 text-accent",
	} as const;

	return (
		<div className={cn("rounded-lg border px-3.5 py-3", tones[tone], className)}>
			<strong className="mb-1 block text-xs font-semibold">{title}</strong>
			<div className="font-mono text-xs leading-relaxed text-ink-dim">{children}</div>
		</div>
	);
}
