import type { ReactNode } from "react";

/**
 * Every page's frame: a coded heading in the instrument style (`WALLET // WHAT CAME HOME`), then its
 * sections. One frame so every page reads the same, and rearranging later moves sections, not styles.
 */
export function Page({
	code,
	title,
	children,
}: {
	code: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<header className="flex flex-col gap-1.5">
				<span className="text-[9.5px] text-neutral-500 tracking-[0.16em]">{code}</span>
				<h1 className="text-[16px] text-neutral-100 tracking-[0.12em]">{title}</h1>
			</header>
			{children}
		</div>
	);
}

/** A titled part of a page. */
export function Part({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section aria-label={title} className="flex flex-col gap-3">
			<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">{title}</h2>
			{children}
		</section>
	);
}

/** What a part will hold once its backend exists, said plainly rather than faked. */
export function Coming({ children }: { children: ReactNode }) {
	return (
		<p className="max-w-[640px] text-[10.5px] text-neutral-600 leading-relaxed tracking-[0.1em]">
			{children}
		</p>
	);
}

/** A plain line of copy. */
export function Copy({ children }: { children: ReactNode }) {
	return (
		<p className="max-w-[640px] text-[11.5px] text-neutral-400 leading-relaxed tracking-[0.08em]">
			{children}
		</p>
	);
}

/** A term and its value, one row of a list. */
export function Row({ term, value }: { term: string; value: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-6 border-white/[0.06] border-b py-2.5 text-[11.5px] tracking-[0.1em]">
			<span className="text-neutral-500">{term}</span>
			<span className="text-right text-neutral-100 tabular-nums">{value}</span>
		</div>
	);
}

/** A button for something that cannot be done yet: shown, so the page is complete, and plainly off. */
export function Later({ children }: { children: ReactNode }) {
	return (
		<button
			type="button"
			disabled
			className="h-10 self-start border border-white/20 px-5 text-[11px] text-neutral-300 tracking-[0.14em] disabled:opacity-40"
		>
			{children}
		</button>
	);
}
