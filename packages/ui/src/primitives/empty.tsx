import type { ReactNode } from "react";

/**
 * Nothing here, and why.
 *
 * `01-PRINCIPLES` P4 rejects a milestone whose evidence is a screenshot, and an
 * empty state that just says "no items" is the same failure in miniature: it
 * cannot be told apart from a surface that is broken. Every empty state here says
 * what the emptiness means, and offers the one action that changes it.
 */
export function Empty({
	title,
	children,
	action,
}: {
	readonly title: string;
	readonly children: ReactNode;
	readonly action?: ReactNode;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
			<h2 className="text-lg font-medium text-ink">{title}</h2>
			<p className="max-w-md text-xs leading-relaxed text-ink-dim">{children}</p>
			{action !== undefined && <div className="mt-2">{action}</div>}
		</div>
	);
}
