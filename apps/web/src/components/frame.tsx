import { CaretLeft, CaretRight, User } from "@phosphor-icons/react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { useSession } from "../lib/session.ts";
import { Greeting } from "./greeting.tsx";
import { SECTIONS, Sections } from "./sections.tsx";
import { WalletButton } from "./wallet-button.tsx";

/**
 * The frame, after the Xbox 360 dashboard: a large greeting, the wallet in the corner, the sections as a
 * row of words, and the page beneath as tiles. Handles at the left and right edge step through the
 * sections, as do the arrow keys. Nothing else: no bars, no rails, nothing moving at the edges.
 */

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/** Which section a path belongs to, so the handles know where they are. */
export function sectionIndex(path: string): number {
	const found = SECTIONS.findIndex((section) =>
		section.to === "/" ? path === "/" : path === section.to || path.startsWith(`${section.to}/`),
	);
	return found;
}

function Handle({ side, to, label }: { side: "left" | "right"; to: string; label: string }) {
	return (
		<Link
			to={to}
			aria-label={label}
			title={label}
			className={`group fixed top-1/2 z-20 hidden -translate-y-1/2 items-center px-3 py-10 md:flex ${side === "left" ? "left-2" : "right-2"}`}
		>
			<span className="block h-24 w-[3px] bg-white/25 transition-colors group-hover:bg-white/60" />
			{side === "left" ? (
				<CaretLeft
					size={14}
					className="absolute left-5 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100"
				/>
			) : (
				<CaretRight
					size={14}
					className="absolute right-5 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100"
				/>
			)}
		</Link>
	);
}

export function Frame({ children }: { children: ReactNode }) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const path = useRouterState({ select: (state) => state.location.pathname });
	const navigate = useNavigate();
	const at = sectionIndex(path);
	const previous = at > 0 ? SECTIONS[at - 1] : undefined;
	const next = at >= 0 && at < SECTIONS.length - 1 ? SECTIONS[at + 1] : undefined;

	// The arrow keys page through the sections, unless something is being typed.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select");
			if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === "ArrowLeft" && previous) void navigate({ to: previous.to });
			if (event.key === "ArrowRight" && next) void navigate({ to: next.to });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [navigate, previous, next]);

	return (
		<div className="min-h-dvh">
			{previous ? <Handle side="left" to={previous.to} label={previous.label} /> : null}
			{next ? <Handle side="right" to={next.to} label={next.label} /> : null}
			<div className="mx-auto flex w-full max-w-[1160px] flex-col px-4 pt-[clamp(32px,9vh,120px)] pb-16 md:px-8">
				<header className="flex items-center justify-between gap-6">
					<Greeting />
					<div className="flex items-center gap-4">
						{session.data ? (
							<span className="hidden font-display text-[20px] text-neutral-100 sm:inline">
								{short(session.data.walletAddress)}
							</span>
						) : null}
						{session.data ? (
							<Link
								to="/settings"
								aria-label="Settings"
								className="grid size-12 place-items-center bg-[oklch(1_0_0/0.11)] text-neutral-100 transition-colors hover:bg-[oklch(1_0_0/0.18)]"
							>
								<User size={24} weight="light" />
							</Link>
						) : (
							<WalletButton />
						)}
					</div>
				</header>
				<div className="mt-[clamp(28px,6vh,64px)] mb-3 overflow-x-auto">
					<Sections />
				</div>
				<main>{children}</main>
			</div>
		</div>
	);
}
