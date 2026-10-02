import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tile, type TileSize } from "./bento.tsx";

/**
 * The pieces every detail screen is built from, so they all read the same as Home and a machine: a tile
 * with its content at the top and its name at the bottom, rows of figures, plain notes, and one kind of
 * button. Anything that is not built yet says so in a note; nothing pretends with a dead button.
 */

export const LABEL = "text-[13px] text-neutral-500";
export const BUTTON =
	"inline-flex items-center justify-center bg-white px-4 py-2.5 font-display text-[15px] text-neutral-950 transition-opacity disabled:opacity-30";
export const QUIET =
	"inline-flex items-center justify-center bg-white/[0.08] px-4 py-2.5 font-display text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.14]";

/** A tile with its contents above and its name below, like every tile on Home. */
export function Panel({
	size = "wide",
	name,
	to,
	scroll = false,
	children,
}: {
	size?: TileSize;
	name: string;
	to?: string;
	/** The one kind of tile allowed to scroll, inside itself: a list that can grow. */
	scroll?: boolean;
	children?: ReactNode;
}) {
	return (
		<Tile size={size} label={name} {...(to ? { to } : {})}>
			<div className="flex h-full flex-col justify-between gap-3 p-4">
				<div
					{...(scroll ? { "data-own-drag": true } : {})}
					className={`flex min-h-0 flex-1 flex-col gap-2 ${scroll ? "no-scrollbar overflow-y-auto" : ""}`}
				>
					{children}
				</div>
				<span className={LABEL}>{name}</span>
			</div>
		</Tile>
	);
}

/** A big figure or line at the top of a tile. */
export function Headline({ children }: { children: ReactNode }) {
	return (
		<p className="font-display text-[clamp(20px,2vw,28px)] text-neutral-100 leading-tight">
			{children}
		</p>
	);
}

/** A term and its value, one per row. */
export function Rows({ rows }: { rows: [term: string, value: ReactNode][] }) {
	return (
		<dl className="flex flex-col">
			{rows.map(([term, value]) => (
				<div
					key={term}
					className="flex items-baseline justify-between gap-4 border-white/[0.06] border-b py-2 last:border-b-0"
				>
					<dt className="text-[14px] text-neutral-400">{term}</dt>
					<dd className="text-right font-display text-[15px] text-neutral-100 tabular-nums">
						{value}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** Plain words. Quiet, for what is coming or how something works. */
export function Note({ children }: { children: ReactNode }) {
	return <p className="max-w-[60ch] text-[14px] text-neutral-400 leading-relaxed">{children}</p>;
}

/** A link that reads as a row: where it goes, and an arrow. */
export function Onward({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link
			to={to}
			className="flex items-center justify-between bg-white/[0.06] px-3 py-2.5 text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.12]"
		>
			{children}
			<span aria-hidden="true" className="text-neutral-500">
				→
			</span>
		</Link>
	);
}

/** A link out of Maschina, opening in a new tab. */
export function Away({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="flex items-center justify-between bg-white/[0.06] px-3 py-2.5 text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.12]"
		>
			{children}
			<span aria-hidden="true" className="text-neutral-500">
				↗
			</span>
		</a>
	);
}
