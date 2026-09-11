import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * A raised surface with a heading and a count.
 *
 * The count is here rather than optional-and-usually-omitted because
 * `08-ENVIRONMENT` §1 says a surface fails as a dashboard when it shows state you
 * must go elsewhere to act on. A heading that says how many is a heading that has
 * already answered the first question.
 */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("rounded-lg border border-line bg-raised", className)} {...rest} />;
}

export function PanelHead({
	children,
	count,
	actions,
	className,
}: {
	readonly children: ReactNode;
	readonly count?: number;
	readonly actions?: ReactNode;
	readonly className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-2 border-b border-line px-3 py-2", className)}>
			<span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
				{children}
			</span>
			{count !== undefined && (
				<span className="rounded bg-ground px-1.5 py-0.5 font-mono text-2xs text-ink-faint">
					{count}
				</span>
			)}
			{actions !== undefined && (
				<div className="ml-auto flex items-center gap-1">{actions}</div>
			)}
		</div>
	);
}

export function PanelBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-3", className)} {...rest} />;
}
