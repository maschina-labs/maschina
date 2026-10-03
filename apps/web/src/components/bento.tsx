import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { launchFrom } from "../lib/launch.ts";

/**
 * The tiles every page is laid out in, after the Windows 8 start screen and the Xbox dashboard: glass
 * blocks on a six column grid, every tile a square or a rectangle of squares.
 *
 * The screen never scrolls, so the square is sized to whichever runs out first: the width the grid may
 * take, or the height. The whole grid always fits.
 */

const GAP = 10;

const SPAN = {
	/** One square. */
	small: "col-span-1 row-span-1",
	/** Two squares side by side. */
	wide: "col-span-2 row-span-1",
	/** Two by two. */
	large: "col-span-2 row-span-2",
	/** Four across and two down: the main thing on a page, with a column beside it. */
	big: "col-span-2 row-span-2 md:col-span-4 md:row-span-2",
	/** Four across and every row down: one thing that is the page, such as the globe. */
	hero: "col-span-2 row-span-2 md:col-span-4 md:row-span-3",
} as const;

export type TileSize = keyof typeof SPAN;

export function Bento({ children, label }: { children: ReactNode; label: string }) {
	return (
		<section
			aria-label={label}
			// Phone: two squares across the width, and the page scrolls. Wider: six squares across at most 86% of
			// the width and three down at most 66% of the height, the smaller winning, so the whole grid fits
			// and nothing scrolls.
			className="grid grid-flow-row-dense grid-cols-[repeat(2,var(--u))] [--u:calc((100vw-50px)/2)] md:grid-cols-[repeat(6,var(--u))] md:[--u:min(calc((86cqw-50px)/6),calc((66cqh-20px)/3))]"
			style={{ gridAutoRows: "var(--u)", gap: `${GAP}px` }}
		>
			{children}
		</section>
	);
}

export function Tile({
	size = "small",
	label,
	to,
	href,
	children,
}: {
	size?: TileSize;
	label?: string;
	/** Where the tile opens. Its screen flips out of the tile itself. */
	to?: string;
	/** A file or page outside the app, opened in a new tab: a paper, say. */
	href?: string;
	children?: ReactNode;
}) {
	const navigate = useNavigate();
	// A container, so what is inside can size itself to the tile rather than to the screen.
	const look = `${SPAN[size]} @container relative overflow-hidden bg-white/[0.09] text-left transition-colors duration-300 hover:bg-white/[0.13]`;
	if (href) {
		return (
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				aria-label={label}
				className={`${look} block cursor-pointer active:bg-white/[0.16]`}
			>
				{children}
			</a>
		);
	}
	if (to) {
		return (
			<button
				type="button"
				aria-label={label}
				onClick={(event) => {
					// A click on something inside that handles itself, such as the chart, stays with it.
					if ((event.target as HTMLElement).closest("[data-own-drag]")) return;
					launchFrom(event.currentTarget.getBoundingClientRect());
					void navigate({ to });
				}}
				className={`${look} cursor-pointer active:bg-white/[0.16]`}
			>
				{children}
			</button>
		);
	}
	return (
		<article aria-label={label} className={look}>
			{children}
		</article>
	);
}

/**
 * What a tile shows before it has anything to show, the same in every tile so a page never looks
 * half built: a slow, faint shimmer while loading, one plain line when there is nothing yet, and a
 * plain message with a way to try again when something went wrong.
 */
export function TileLoading() {
	return (
		<div aria-label="Loading" role="status" className="absolute inset-0 overflow-hidden">
			<div className="absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
		</div>
	);
}

export function TileEmpty({ children }: { children: ReactNode }) {
	return (
		<p className="absolute bottom-4 left-4 right-4 font-display text-[14px] text-neutral-500">
			{children}
		</p>
	);
}

export function TileProblem({ children, retry }: { children: ReactNode; retry?: () => void }) {
	return (
		<div role="alert" className="absolute inset-x-4 bottom-4 flex flex-col items-start gap-2">
			<p className="font-display text-[14px] text-neutral-300">{children}</p>
			{retry ? (
				<button
					type="button"
					onClick={retry}
					className="font-display text-[13px] text-neutral-500 transition-colors hover:text-neutral-100"
				>
					Try again
				</button>
			) : null}
		</div>
	);
}
