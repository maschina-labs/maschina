/**
 * The pieces every screen is built from.
 *
 * Small on purpose. A control surface for money is read at a glance and acted on quickly, so controls are
 * compact, rows are dense, and nothing is larger than the job it does. The rule throughout: type carries
 * the hierarchy, lines carry the structure, and colour is spent only on what has to be noticed.
 *
 * Anything that is a number, an address, a time or an identifier is set in mono, so two of them under one
 * another can be compared without reading them.
 */

import type { Icon } from "@phosphor-icons/react";
import { CaretRight } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";

/* ---------------------------------------------------------------- buttons */

type ButtonTone = "primary" | "quiet" | "outline" | "danger";

const TONES: Record<ButtonTone, string> = {
	primary: "bg-accent text-[oklch(0.14_0.01_254)] hover:bg-accent-hover",
	quiet: "text-text-muted hover:bg-muted hover:text-text",
	outline: "border border-line text-text hover:border-line-strong hover:bg-muted",
	// Outlined rather than filled: a destructive action should be reachable without being loud.
	danger: "border border-danger/35 text-danger-text hover:border-danger/60 hover:bg-danger-wash/50",
};

export function Button({
	tone = "outline",
	icon: Glyph,
	children,
	className = "",
	...rest
}: {
	tone?: ButtonTone;
	icon?: Icon;
	children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-medium text-[12px] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${TONES[tone]} ${className}`}
			{...rest}
		>
			{Glyph ? <Glyph size={13} /> : null}
			{children}
		</button>
	);
}

/** A button that is only an icon. It still says what it does, for anybody not using a mouse. */
export function IconButton({
	icon: Glyph,
	label,
	size = 15,
	className = "",
	...rest
}: { icon: Icon; label: string; size?: number } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint transition-colors duration-150 hover:bg-muted hover:text-text disabled:pointer-events-none disabled:opacity-40 ${className}`}
			{...rest}
		>
			<Glyph size={size} />
		</button>
	);
}

/* ------------------------------------------------------------------ pills */

type PillTone = "live" | "neutral" | "quiet" | "danger";

const PILL_TONES: Record<PillTone, string> = {
	live: "border-accent-quiet/60 bg-accent-wash/60 text-accent-text",
	neutral: "border-line-strong bg-muted text-text",
	quiet: "border-line bg-transparent text-text-faint",
	danger: "border-danger/35 bg-danger-wash/50 text-danger-text",
};

/**
 * A state, in as few pixels as it can be read in.
 *
 * `live` carries a dot that breathes, because a machine that is running is the one fact somebody wants
 * from across a room.
 */
export function Pill({
	tone = "neutral",
	dot = false,
	children,
}: {
	tone?: PillTone;
	dot?: boolean;
	children: ReactNode;
}) {
	return (
		<span
			className={`inline-flex h-[19px] items-center gap-1.5 rounded border px-1.5 font-medium font-mono text-[10px] uppercase tracking-[0.06em] ${PILL_TONES[tone]}`}
		>
			{dot ? <span className="size-1.5 shrink-0 animate-live rounded-full bg-current" /> : null}
			{children}
		</span>
	);
}

/* ------------------------------------------------------------------ panel */

/** A bordered region with a title. The border is the structure; there is no shadow and no fill. */
export function Panel({
	title,
	note,
	actions,
	children,
	className = "",
}: {
	title: string;
	/** One line under the title, for what the panel means rather than what it is called. */
	note?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={`rounded-lg border border-line bg-surface ${className}`}>
			<header className="flex items-start justify-between gap-4 border-line border-b px-4 py-3">
				<div className="min-w-0">
					<h2 className="font-medium text-[12px] text-text uppercase tracking-[0.08em]">{title}</h2>
					{note ? <p className="mt-1 text-[12px] text-text-faint">{note}</p> : null}
				</div>
				{actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
			</header>
			{children}
		</section>
	);
}

/* ------------------------------------------------------------------- data */

/** A label above a number. The label is quiet, the number is not. */
export function Metric({
	label,
	value,
	unit,
	tone = "text",
}: {
	label: string;
	value: string;
	unit?: string;
	tone?: "text" | "muted" | "accent" | "danger";
}) {
	const colour =
		tone === "accent"
			? "text-accent-text"
			: tone === "danger"
				? "text-danger-text"
				: tone === "muted"
					? "text-text-muted"
					: "text-text";
	return (
		<div className="min-w-0">
			<div className="text-[10px] text-text-faint uppercase tracking-[0.08em]">{label}</div>
			<div className={`mt-1 truncate font-mono text-[15px] ${colour}`}>
				{value}
				{unit ? <span className="ml-1 text-[11px] text-text-faint">{unit}</span> : null}
			</div>
		</div>
	);
}

/** A label and a value on one line, for lists of facts. */
export function Row({
	label,
	children,
	mono = true,
}: {
	label: string;
	children: ReactNode;
	mono?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-line/60 border-b px-4 py-2 last:border-0">
			<span className="shrink-0 text-[12px] text-text-faint">{label}</span>
			<span className={`min-w-0 truncate text-right text-[12px] ${mono ? "font-mono" : ""}`}>
				{children}
			</span>
		</div>
	);
}

/**
 * A budget as a line rather than a number.
 *
 * Three parts in one bar, in the order money moves through it: spent, held against trades in flight, and
 * what is left. The bar is the only geometry in the interface, and it earns it by making four numbers
 * into one glance.
 */
export function Meter({ granted, held, spent }: { granted: number; held: number; spent: number }) {
	const share = (part: number) => (granted > 0 ? Math.min(100, (part / granted) * 100) : 0);
	return (
		<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-inset">
			<div className="bg-accent" style={{ width: `${share(spent)}%` }} />
			<div className="bg-accent-quiet" style={{ width: `${share(held)}%` }} />
		</div>
	);
}

/**
 * A payload, folded away until somebody wants it.
 *
 * The record is the product's best argument and its payloads are its evidence, so they are always
 * reachable and never in the way.
 */
export function Payload({ value }: { value: unknown }) {
	const [open, setOpen] = useState(false);
	const text = JSON.stringify(value, null, 2);
	if (text === "{}" || text === undefined) return null;

	return (
		<div className="mt-1.5">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="inline-flex items-center gap-1 text-[11px] text-text-faint transition-colors duration-150 hover:text-text-muted"
			>
				<CaretRight
					size={9}
					weight="bold"
					className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
				/>
				{open ? "hide" : "payload"}
			</button>
			{open ? (
				<pre className="mt-1.5 overflow-x-auto rounded border border-line/70 bg-inset px-2.5 py-2 font-mono text-[11px] text-text-muted leading-[1.6]">
					{text}
				</pre>
			) : null}
		</div>
	);
}

/* ----------------------------------------------------------------- states */

/**
 * Nothing here yet, and what to do about it.
 *
 * An empty screen that only says "no machines" is a dead end. Every empty state in the product names the
 * thing that is missing and offers the one action that fixes it.
 */
export function Empty({
	icon: Glyph,
	title,
	note,
	action,
}: {
	icon: Icon;
	title: string;
	note: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div className="flex size-9 items-center justify-center rounded-lg border border-line bg-inset text-text-faint">
				<Glyph size={17} />
			</div>
			<p className="mt-3.5 font-medium text-[13px] text-text">{title}</p>
			<p className="mt-1 max-w-[42ch] text-[12px] text-text-muted leading-relaxed">{note}</p>
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}

/**
 * Something is wrong, said in words and with the reason kept.
 *
 * The message from the API is shown rather than replaced by something friendlier, because the person
 * reading it is the person who can act on it, and "something went wrong" has never helped anybody.
 */
export function Failed({
	title = "That did not work",
	detail,
	retry,
}: {
	title?: string;
	detail?: string;
	retry?: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div className="flex size-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-wash/40 text-danger-text">
				<svg viewBox="0 0 24 24" className="size-[17px]" fill="none" aria-hidden="true">
					<path
						d="M12 8v5m0 3h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
						stroke="currentColor"
						strokeWidth="1.6"
						strokeLinecap="round"
					/>
				</svg>
			</div>
			<p className="mt-3.5 font-medium text-[13px] text-text">{title}</p>
			{detail ? (
				<p className="mt-1.5 max-w-[52ch] font-mono text-[11px] text-danger-text/90 leading-relaxed">
					{detail}
				</p>
			) : null}
			{retry ? (
				<div className="mt-4">
					<Button onClick={retry}>Try again</Button>
				</div>
			) : null}
		</div>
	);
}

/**
 * Waiting, shown as the shape of what is coming.
 *
 * Bars the size of the rows that will replace them, so the page does not jump when the answer arrives.
 */
export function Loading({ rows = 3 }: { rows?: number }) {
	return (
		<div className="space-y-2 px-4 py-4" aria-busy="true" aria-live="polite">
			<span className="sr-only">Loading</span>
			{Array.from({ length: rows }, (_, index) => (
				<div
					key={index}
					className="h-7 animate-pulse rounded bg-muted"
					style={{ width: `${88 - index * 11}%`, animationDelay: `${index * 90}ms` }}
				/>
			))}
		</div>
	);
}

/** The title block at the top of a screen. Every screen has exactly one. */
export function PageHead({
	title,
	note,
	actions,
	children,
}: {
	title: string;
	note?: string;
	actions?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<header className="flex flex-wrap items-start justify-between gap-4 border-line border-b px-7 py-5">
			<div className="min-w-0">
				<h1 className="truncate font-medium text-[17px] text-text tracking-[-0.01em]">{title}</h1>
				{note ? <p className="mt-1 text-[12px] text-text-muted">{note}</p> : null}
				{children}
			</div>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
		</header>
	);
}
