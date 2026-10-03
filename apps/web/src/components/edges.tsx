import {
	ArrowLeft,
	ArrowsLeftRight,
	Bell,
	BookOpen,
	Check,
	Clock,
	Copy,
	FileText,
	GearSix,
	MagnifyingGlass,
	Moon,
	Pause,
	Play,
	Plus,
	Robot,
	SidebarSimple,
	SignOut,
	Sparkle,
	SquaresFour,
	Sun,
	User,
	Wallet,
	X,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { alertsFrom, lastSeen, markSeen, unread } from "../lib/alerts.ts";
import { describeEvent } from "../lib/describe.ts";
import { playIdleNow, setIdleMode, useIdleMode } from "../lib/idle.ts";
import {
	forgetWallet,
	rememberWallet,
	shortAddress,
	useKnownWallets,
} from "../lib/known-wallets.ts";
import { amount, useMachines } from "../lib/machines.ts";
import { useManagerKey } from "../lib/manager-key.ts";
import { onPaper, totalsOf } from "../lib/portfolio.ts";
import { useSession, useSignIn, useSignOut } from "../lib/session.ts";
import { setSide, useSide } from "../lib/side.ts";
import { setTheme, THEMES, useTheme } from "../lib/theme.ts";
import { useActivity } from "./portfolio.tsx";
import { openSearch } from "./search.tsx";
import { SECTIONS } from "./sections.tsx";

/**
 * The edges: a mark at the top, the left and the right, unseen until the
 * pointer comes to it, and no words.
 * Click one and its panel slides in and stays; click anywhere else, or press Escape, and it slides out.
 *
 *   top    the header: the time, the date, the price of SOL
 *   left   your machines
 *   right  alerts, then tiles: search, idle mode, light or dark, settings. A dot on this edge, the one
 *          thing that shows without the pointer there, says there are alerts you have not seen.

 * Your account has its own panel on the right too, opened from the account tile rather than an edge.
 */

/** The three edges, and the account, which has its own panel on the right opened from its tile. */
type Edge = "top" | "left" | "right" | "account" | "sections";

/**
 * Which panel is open, kept in one place that the panels and the page both read, so a sidebar and the
 * page it pushes change on the same frame and travel as one.
 */
let current: Edge | undefined;
const listeners = new Set<() => void>();
function setEdge(next: Edge | undefined) {
	if (next === current) return;
	current = next;
	for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * Alerts: what your machines did that is worth knowing, and how many arrived since you last opened the
 * tiles. Opening them is looking at them.
 */
function useAlerts() {
	const feed = useActivity();
	const alerts = alertsFrom(feed);
	const [seenAt, setSeenAt] = useState(lastSeen);
	const open = useOpenEdge();
	useEffect(() => {
		if (open !== "right") return;
		const now = new Date().toISOString();
		markSeen(now);
		setSeenAt(now);
	}, [open]);
	return { alerts, fresh: unread(alerts, seenAt) };
}

/** Which panel is open right now. */
export function useOpenEdge(): Edge | undefined {
	return useSyncExternalStore(subscribe, () => current);
}

const SIDE_WIDTH = "w-[86vw] md:w-[340px]";

/**
 * The sidebars, laid over the page: they glide in from their edge on one smooth curve while the page
 * stays exactly where it is and dims a little behind them, so your place is never moved. Only the one
 * in use is shown, and it stays shown while it glides away. A tap on the dimmed page, Escape, or a
 * swipe back towards its edge closes it.
 */
export function SideRail() {
	const open = useOpenEdge();
	const [last, setLast] = useState<Edge>();
	useEffect(() => {
		if (open && open !== "top") setLast(open);
	}, [open]);
	const swipe = useRef<number | undefined>(undefined);
	const side = (edge: Edge, from: "left" | "right", label: string, children: ReactNode) => (
		<aside
			key={edge}
			aria-label={label}
			aria-hidden={open !== edge}
			className={`fixed inset-y-0 z-40 flex flex-col bg-(--surface-panel) backdrop-blur-2xl transition-[translate] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${SIDE_WIDTH} ${
				from === "left"
					? `left-0 ${open === edge ? "translate-x-0" : "-translate-x-full"}`
					: `right-0 ${open === edge ? "translate-x-0" : "translate-x-full"}`
			} ${last === edge ? "" : "invisible"}`}
			onTouchStart={(event) => {
				swipe.current = event.touches[0]?.clientX;
			}}
			onTouchEnd={(event) => {
				const start = swipe.current;
				const end = event.changedTouches[0]?.clientX;
				swipe.current = undefined;
				if (start === undefined || end === undefined) return;
				const moved = end - start;
				if ((from === "left" && moved < -60) || (from === "right" && moved > 60))
					setEdge(undefined);
			}}
		>
			{children}
		</aside>
	);
	return (
		<>
			{/* On a phone the page dims behind an open sidebar and a tap closes it; on a desktop the sidebar pushes the page aside instead. */}
			<button
				type="button"
				aria-label="Close"
				tabIndex={-1}
				onClick={() => setEdge(undefined)}
				className={`fixed inset-0 z-30 cursor-default bg-black/30 transition-opacity md:hidden duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${open && open !== "top" ? "opacity-100" : "pointer-events-none opacity-0"}`}
			/>
			{side("left", "left", "Your machines", <MachinesPanel />)}
			{side("account", "right", "Account", <AccountPanel />)}
			{side(
				"sections",
				"right",
				"Section menu",
				<SectionsPanel onChoose={() => setEdge(undefined)} />,
			)}
			{side("right", "right", "Tiles", <TilesPanel />)}
		</>
	);
}

/** Opens a panel from anywhere, such as the account tile opening its own. */
export function openEdge(edge: Edge) {
	setEdge(edge);
}

const PANEL =
	"fixed z-40 bg-(--surface-bar) backdrop-blur-2xl transition-[translate,transform,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

/** How far a panel has to be dragged towards its edge before letting go closes it. */
const DISMISS = 90;

/**
 * One panel, sliding in from its edge. Any of them can be dragged back the way it came: it follows the
 * finger, closes past a point, and springs back short of it.
 */
function Panel({
	label,
	from,
	open,
	width = "",
	onClose,
	handle,
	children,
}: {
	label: string;
	from: "top" | "left" | "right";
	open: boolean;
	width?: string;
	onClose: () => void;
	/** Something fixed to the panel's outer edge, which moves with it: the header's own mark. */
	handle?: ReactNode;
	children: ReactNode;
}) {
	const [pulled, setPulled] = useState(0);
	const drag = useRef<{ x: number; y: number; axis?: "x" | "y"; sheet: boolean } | undefined>(
		undefined,
	);

	// Sidebars on every screen: they slide in from their own edge, most of a phone's width, a fixed width
	// from a tablet up. The header drops from the top. Sheets rising from the bottom are kept for
	// actions in context, such as funding a machine.
	const place =
		from === "top"
			? `inset-x-0 top-0 ${open ? "translate-y-0" : "-translate-y-full"}`
			: `inset-y-0 w-[86vw] ${width} ${
					from === "left"
						? `left-0 ${open ? "translate-x-0" : "-translate-x-full"}`
						: `right-0 ${open ? "translate-x-0" : "translate-x-full"}`
				}`;

	// Which way is "back" for this panel.
	const back = (): { axis: "x" | "y"; sign: 1 | -1 } =>
		from === "top" ? { axis: "y", sign: -1 } : { axis: "x", sign: from === "left" ? -1 : 1 };

	return (
		<aside
			aria-label={label}
			className={`${PANEL} flex flex-col ${place} ${pulled ? "duration-0" : ""}`}
			style={
				pulled
					? {
							translate: back().axis === "y" ? `0 ${pulled}px` : `${pulled}px 0`,
						}
					: undefined
			}
			onTouchStart={(event) => {
				const first = event.touches[0];
				if (!first) return;
				drag.current = {
					x: first.clientX,
					y: first.clientY,
					sheet: window.innerWidth < 768 && from !== "top",
				};
			}}
			onTouchMove={(event) => {
				const now = event.touches[0];
				const start = drag.current;
				if (!now || !start) return;
				const way = back();
				const moved = way.axis === "y" ? now.clientY - start.y : now.clientX - start.x;
				if (start.axis === undefined) {
					const dx = Math.abs(now.clientX - start.x);
					const dy = Math.abs(now.clientY - start.y);
					if (dx < 8 && dy < 8) return;
					start.axis = dx > dy ? "x" : "y";
					// Something scrolled down inside scrolls back up before the sheet itself moves.
					const scroller = (event.target as HTMLElement).closest("[data-scroll]");
					if (start.axis !== way.axis || (scroller && scroller.scrollTop > 0 && way.axis === "y")) {
						drag.current = undefined;
						return;
					}
				}
				setPulled(moved * way.sign > 0 ? moved : 0);
			}}
			onTouchEnd={() => {
				const start = drag.current;
				drag.current = undefined;
				if (start && Math.abs(pulled) > DISMISS) onClose();
				setPulled(0);
			}}
		>
			{/* Hidden while closed, all but the handle, which is how it opens. */}
			<div aria-hidden={!open} className="contents">
				{children}
			</div>
			{handle}
		</aside>
	);
}

export function Edges() {
	const router = useRouter();
	const open = useOpenEdge();
	const { fresh } = useAlerts();
	const toggle = (edge: Edge) => setEdge(current === edge ? undefined : edge);
	const close = () => setEdge(undefined);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setEdge(undefined);
			// Command J, or Control J, opens the manager from anywhere.
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
				event.preventDefault();
				void router.navigate({ to: "/manager" });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<>
			{/* Anywhere else on the screen closes the header. */}
			{open === "top" ? (
				<button
					type="button"
					aria-label="Close"
					tabIndex={-1}
					onClick={close}
					className="fixed inset-0 z-30 cursor-default"
				/>
			) : null}
			<Mark
				edge="left"
				label="Your machines"
				onPress={() => toggle("left")}
				attached={open === "left"}
			/>
			<Mark
				edge="right"
				label="Tiles"
				onPress={() => toggle("right")}
				news={fresh > 0}
				attached={open === "right" || open === "account" || open === "sections"}
			/>
			<Dock open={open} onPress={toggle} news={fresh > 0} />

			<Panel
				label="Header"
				from="top"
				open={open === "top"}
				onClose={close}
				// The header's mark hangs from its bottom edge, so it drops and rises with the header itself.
				handle={
					<button
						type="button"
						aria-label="Header"
						onClick={() => toggle("top")}
						className="group absolute inset-x-0 top-full hidden h-5 items-start justify-center pt-1.5 md:flex"
					>
						<span
							className={`block h-[3px] w-14 bg-white/50 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 opacity-0`}
						/>
					</button>
				}
			>
				<HeaderPanel />
			</Panel>
		</>
	);
}

/** A faint bar on an edge and the strip around it that notices the pointer. */
function Mark({
	edge,
	label,
	onPress,
	news = false,
	attached = false,
}: {
	edge: Edge;
	label: string;
	onPress: () => void;
	/** Something new to see: the one thing on the edges that shows without the pointer there. */
	news?: boolean;
	/**
	 * Its sidebar is open: the mark rides the sidebar's edge, stays in sight, and closes it on a press.
	 */
	attached?: boolean;
}) {
	const side = edge === "left" ? "left" : "right";
	const zone =
		edge === "top"
			? "inset-x-0 top-0 h-5 justify-center items-start pt-1.5"
			: `inset-y-0 w-5 items-center ${edge === "left" ? "justify-start pl-1.5" : "justify-end pr-1.5"}`;
	const bar = edge === "top" ? "h-[3px] w-14" : "h-14 w-[3px]";
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onPress}
			// A phone has no pointer to come to an edge, so it has the dock instead.
			// It slides exactly as the sidebar does, the same property, time and curve, so the two move as
			// one: it sits a sidebar's width in from its edge and is slid back out to the edge while closed.
			className={`group fixed z-[45] hidden transition-[translate] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] md:flex ${zone} ${
				edge === "top"
					? ""
					: attached
						? "translate-x-0"
						: side === "left"
							? "-translate-x-[var(--side)]"
							: "translate-x-[var(--side)]"
			}`}
			style={edge === "top" ? undefined : { [side]: "var(--side)" }}
		>
			<span
				// Unseen until the pointer comes to it, open or closed, then a quiet mark that something is
				// there. Riding an open sidebar, it is how that sidebar closes.
				className={`block ${bar} bg-white/50 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 opacity-0`}
			/>
			{news ? (
				<span
					aria-hidden="true"
					className="absolute top-1/2 right-1.5 size-1.5 -translate-y-1/2 bg-white group-hover:opacity-0"
				/>
			) : null}
		</button>
	);
}

/**
 * The phone's dock, after the Windows Phone app bar: a few square glass keys floating at the bottom,
 * each opening one of the panels the edges open on a desktop.
 */
function Dock({
	open,
	onPress,
	news,
}: {
	open: Edge | undefined;
	onPress: (edge: Edge) => void;
	news: boolean;
}) {
	const keys = [
		{ edge: "left", label: "Your machines", Icon: Robot },
		{ edge: "top", label: "Now", Icon: Clock },
		{ edge: "right", label: "Tiles", Icon: SquaresFour },
		{ edge: "account", label: "Account", Icon: User },
	] as const;
	return (
		<nav
			aria-label="Dock"
			// Out of the way while a sheet is up; back when it closes.
			className={`fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-50 flex justify-center gap-2.5 transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden ${open && open !== "top" ? "translate-y-[160%]" : ""}`}
		>
			{keys.map(({ edge, label, Icon }) => (
				<button
					key={edge}
					type="button"
					aria-label={label}
					aria-pressed={open === edge}
					onClick={() => onPress(edge)}
					// Square glass, the same as the account tile.
					className={`relative grid size-[58px] place-items-center backdrop-blur-xl transition-colors duration-300 ${
						open === edge ? "bg-white text-neutral-950" : "bg-(--surface-chip) text-neutral-100"
					}`}
				>
					<Icon size={26} weight="light" />
					{news && edge === "right" ? (
						<span aria-hidden="true" className="absolute top-2 right-2 size-1.5 bg-white" />
					) : null}
				</button>
			))}
		</nav>
	);
}

/** Every section, for the phone's menu. */
function SectionsPanel({ onChoose }: { onChoose: () => void }) {
	const path = useRouterState({ select: (state) => state.location.pathname });
	return (
		<div
			data-scroll
			className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-8 pb-10"
		>
			<button
				type="button"
				onClick={() => {
					onChoose();
					openSearch();
				}}
				className="flex items-center gap-3 bg-white/[0.06] px-4 py-3.5 text-left font-display text-[17px] text-neutral-300"
			>
				<MagnifyingGlass size={20} weight="light" />
				Search
			</button>
			<Section title="Sections">
				<ul className="flex flex-col gap-1.5">
					{SECTIONS.map((section) => {
						const here = section.to === "/" ? path === "/" : path.startsWith(section.to);
						return (
							<li key={section.to}>
								<Link
									to={section.to}
									onClick={onChoose}
									className={`block px-4 py-3.5 font-display text-[18px] transition-colors ${here ? "bg-white/[0.14] text-white" : "bg-white/[0.06] text-neutral-300"}`}
								>
									{section.label}
								</Link>
							</li>
						);
					})}
				</ul>
			</Section>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-[13px] text-neutral-500">{title}</h2>
			{children}
		</section>
	);
}

/** Maschina's front page: the welcome screen for now, its own site once it is built. */
const FRONT_PAGE = "/welcome";

function HeaderPanel() {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);
	// The name on the left, the time on the right, centered on one line and as wide as the tiles below, so
	// both line up with the grid's edges.
	return (
		<div className="flex justify-center px-5 py-7 md:px-0">
			<div className="flex w-full items-center justify-between gap-6 md:w-[calc(var(--u)*6+50px)] md:[--u:min(calc((86cqw-50px)/6),calc((66cqh-20px)/3))]">
				{/*
				 * Back out to Maschina's front page. Until the front page is its own site, that is the welcome
				 * screen here; once it is built, FRONT_PAGE becomes its address.
				 */}
				<div className="flex items-center gap-4">
					<a
						href={FRONT_PAGE}
						aria-label="Back to the front page"
						className="grid size-12 place-items-center bg-white/[0.11] text-neutral-100 transition-colors duration-300 hover:bg-white/[0.18]"
					>
						<ArrowLeft size={22} weight="light" />
					</a>
				</div>
				<div className="flex flex-col items-end gap-1">
					<span className="font-display text-[28px] text-neutral-100 tabular-nums leading-none">
						{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
					</span>
					<span className="text-[14px] text-neutral-400">
						{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
					</span>
				</div>
			</div>
		</div>
	);
}

/**
 * The left sidebar: everything to do with machines and the AI. Ask the manager, make a machine, open any
 * of yours, and pick up a conversation. Settings, preferences and alerts are on the right.
 */
function MachinesPanel() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const list = session.data ? (machines.data ?? []) : [];
	const row =
		"flex items-center gap-3 bg-white/[0.06] px-4 py-3 text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.12]";
	return (
		<div
			data-scroll
			className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-10 pb-8"
		>
			{/* The name at the top of the left sidebar, where an app keeps its own, and the way to close it. */}
			<div className="flex items-center justify-between gap-3">
				<img src="/brand/word.svg" alt="Maschina" className="h-5 w-auto" />
				<button
					type="button"
					aria-label="Close sidebar"
					title="Close sidebar"
					onClick={() => setEdge(undefined)}
					className="grid size-10 place-items-center bg-white/[0.11] text-neutral-100 transition-colors duration-300 hover:bg-white/[0.18]"
				>
					<SidebarSimple size={20} weight="light" />
				</button>
			</div>
			<div className="flex flex-col gap-1.5">
				<Link to="/manager" className={row}>
					<Sparkle size={18} weight="light" />
					<span className="flex-1">Ask your manager</span>
					<span className="text-[13px] text-neutral-500">⌘J</span>
				</Link>
				<Link to="/new" className={row}>
					<Plus size={18} weight="light" />
					<span className="flex-1">New machine</span>
				</Link>
			</div>
			<Section title="Your machines">
				{!session.data ? (
					<p className="text-[15px] text-neutral-400">Connect to see your machines.</p>
				) : list.length === 0 ? (
					<p className="text-[15px] text-neutral-400">No machines yet.</p>
				) : (
					<ul className="flex flex-col gap-1.5">
						{list.map((machine) => (
							<li key={machine.machineId}>
								<Link
									to="/machines/$machineId"
									params={{ machineId: machine.machineId }}
									className="flex items-center justify-between gap-4 bg-white/[0.06] px-4 py-3 transition-colors hover:bg-white/[0.12]"
								>
									<span className="truncate text-[15px] text-neutral-100">{machine.name}</span>
									<span
										className={`shrink-0 text-[13px] ${machine.state === "running" ? "text-neutral-100" : "text-neutral-500"}`}
									>
										{machine.state}
										{onPaper(machine) ? " · paper" : ""}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</Section>
			<Section title="Conversations">
				<p className="text-[15px] text-neutral-400">
					Your conversations with the manager will be kept here.
				</p>
			</Section>
		</div>
	);
}

/**
 * The account sidebar: who is signed in, what their money is doing, the wallets this browser knows, and
 * the way out. Switching wallets signs out and asks the wallet to connect again: the wallet app decides
 * which account answers, so the switcher can only ever ask, never choose for it.
 */
function AccountPanel() {
	const router = useRouter();
	const { api } = router.options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const machines = useMachines(api);
	const side = useSide();
	const signOut = useSignOut(api, queryClient);
	const signIn = useSignIn(api, queryClient);
	const known = useKnownWallets();
	const key = useManagerKey(api, Boolean(session.data));
	const [copied, setCopied] = useState(false);
	const address = session.data?.walletAddress;
	useEffect(() => {
		if (address) rememberWallet(address);
	}, [address]);
	if (!address) return null;

	const totals = totalsOf(machines.data ?? [], side);
	const others = known.filter((each) => each.address !== address);
	const row =
		"flex items-center gap-3 bg-white/[0.06] px-4 py-3 text-[14px] text-neutral-100 transition-colors hover:bg-white/[0.12]";
	const switchWallet = async () => {
		await signOut.mutateAsync();
		signIn.mutate();
	};
	const go = (to: string) => () => {
		setEdge(undefined);
		void router.navigate({ to });
	};

	return (
		<div
			data-scroll
			className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-10 pb-8"
		>
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className="grid size-11 shrink-0 place-items-center bg-white/[0.11] text-neutral-100"
				>
					<User size={22} weight="light" />
				</span>
				<div className="flex min-w-0 flex-col">
					<span className="font-mono text-[15px] text-neutral-100">{shortAddress(address)}</span>
					<span className="text-[13px] text-neutral-500">
						Showing {side === "paper" ? "paper" : "live"} money
					</span>
				</div>
				<button
					type="button"
					aria-label={copied ? "Copied" : "Copy address"}
					title="Copy address"
					onClick={() => {
						void navigator.clipboard?.writeText(address);
						setCopied(true);
						setTimeout(() => setCopied(false), 1500);
					}}
					className="ml-auto grid size-9 place-items-center text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
				>
					{copied ? <Check size={18} weight="light" /> : <Copy size={18} weight="light" />}
				</button>
			</div>

			<Section title={side === "paper" ? "Your money · paper" : "Your money"}>
				<div className="grid grid-cols-2 gap-1.5">
					<div className="flex flex-col gap-0.5 bg-white/[0.06] px-4 py-3">
						<span className="text-[12px] text-neutral-500">At work</span>
						<span className="text-[16px] text-neutral-100">
							${amount(totals.granted.toString())}
						</span>
					</div>
					<div className="flex flex-col gap-0.5 bg-white/[0.06] px-4 py-3">
						<span className="text-[12px] text-neutral-500">Realized</span>
						<span className="text-[16px] text-neutral-100">
							${amount(totals.realized.toString())}
						</span>
					</div>
				</div>
				<p className="text-[13px] text-neutral-500">
					{totals.running} of {totals.machines} machine{totals.machines === 1 ? "" : "s"} running
				</p>
			</Section>

			<Section title="Wallets">
				<div className={`${row} cursor-default hover:bg-white/[0.06]`}>
					<Wallet size={18} weight="light" />
					<span className="flex-1 font-mono">{shortAddress(address)}</span>
					<span className="text-[12px] text-neutral-500">Signed in</span>
				</div>
				{others.map((each) => (
					<div key={each.address} className="flex gap-1.5">
						<button
							type="button"
							onClick={() => void switchWallet()}
							title="Sign out, then pick this account in your wallet"
							className={`${row} flex-1`}
						>
							<Wallet size={18} weight="light" className="text-neutral-500" />
							<span className="flex-1 text-left font-mono">{shortAddress(each.address)}</span>
							<span className="text-[12px] text-neutral-500">Switch</span>
						</button>
						<button
							type="button"
							aria-label={`Forget ${shortAddress(each.address)}`}
							onClick={() => forgetWallet(each.address)}
							className="grid w-11 place-items-center bg-white/[0.06] text-neutral-500 transition-colors hover:bg-white/[0.12] hover:text-neutral-100"
						>
							<X size={14} weight="light" />
						</button>
					</div>
				))}
				<button
					type="button"
					disabled={signOut.isPending || signIn.isPending}
					onClick={() => void switchWallet()}
					className={`${row} disabled:opacity-50`}
				>
					<ArrowsLeftRight size={18} weight="light" />
					<span className="flex-1 text-left">
						{signIn.isPending ? "Waiting for your wallet" : "Switch wallet"}
					</span>
				</button>
				<p className="text-[12px] text-neutral-500">
					Your wallet decides which account connects: pick the one you want in its window.
				</p>
			</Section>

			<Section title="Shortcuts">
				<div className="flex flex-col gap-1.5">
					<button type="button" onClick={go("/settings")} className={row}>
						<GearSix size={18} weight="light" />
						<span className="flex-1 text-left">Settings</span>
					</button>
					<button type="button" onClick={go("/settings/alerts")} className={row}>
						<Bell size={18} weight="light" />
						<span className="flex-1 text-left">Alerts</span>
					</button>
					<button type="button" onClick={go("/settings")} className={row}>
						<Sparkle size={18} weight="light" />
						<span className="flex-1 text-left">AI key</span>
						<span className="text-[12px] text-neutral-500">
							{key.data?.set ? `ending ${key.data.hint}` : "not set"}
						</span>
					</button>
					<button type="button" onClick={go("/papers")} className={row}>
						<FileText size={18} weight="light" />
						<span className="flex-1 text-left">Papers</span>
					</button>
				</div>
			</Section>

			<button
				type="button"
				disabled={signOut.isPending}
				onClick={() => signOut.mutate()}
				className="mt-auto flex items-center justify-center gap-2 bg-white/[0.06] px-4 py-3 text-[14px] text-neutral-100 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
			>
				<SignOut size={16} weight="light" />
				Disconnect
			</button>
		</div>
	);
}

/** The latest alerts, in plain words, at the top of the tiles. */
function AlertsSection() {
	const { alerts } = useAlerts();
	return (
		<Section title={alerts.length ? `Alerts · ${alerts.length}` : "Alerts"}>
			{alerts.length === 0 ? (
				<p className="text-[15px] text-neutral-400">Nothing to tell you yet.</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{alerts.slice(0, 4).map((alert) => {
						const said = describeEvent(alert);
						return (
							<li key={alert.id} className="flex flex-col gap-0.5 bg-white/[0.06] px-4 py-3">
								<span className="text-[15px] text-neutral-100">
									{alert.machineName} · {said.title.toLowerCase()}
								</span>
								<span className="text-[13px] text-neutral-500">
									{new Date(alert.occurredAt).toLocaleString([], {
										month: "short",
										day: "numeric",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</li>
						);
					})}
				</ul>
			)}
			<Link
				to="/settings/alerts"
				onClick={() => setEdge(undefined)}
				className="text-[14px] text-neutral-400 hover:text-neutral-100"
			>
				See all
			</Link>
		</Section>
	);
}

function TilesPanel() {
	const idle = useIdleMode();
	const { theme } = useTheme();
	const side = useSide();
	const tile =
		"flex items-center gap-4 bg-white/[0.06] px-4 py-3.5 text-left text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.12]";
	return (
		<div
			data-scroll
			className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-10 pb-8"
		>
			<AlertsSection />
			<Section title="Tiles">
				<button
					type="button"
					onClick={() => {
						setEdge(undefined);
						openSearch();
					}}
					className={tile}
				>
					<MagnifyingGlass size={20} weight="light" />
					<span className="flex-1">Search</span>
					<span className="text-[13px] text-neutral-500">⌘K</span>
				</button>
				{/* One switch: on plays it now and lets it start by itself after a minute; off stops it. */}
				<button
					type="button"
					onClick={() => {
						if (idle) {
							setIdleMode(false);
							return;
						}
						setIdleMode(true);
						setEdge(undefined);
						// After the switch has reached the dashboard, so the drift it starts is the one that runs.
						setTimeout(playIdleNow, 50);
					}}
					className={tile}
				>
					{idle ? <Pause size={20} weight="light" /> : <Play size={20} weight="light" />}
					<span className="flex-1">Idle mode</span>
					<span className="text-[13px] text-neutral-400">{idle ? "On" : "Off"}</span>
				</button>
				<div className="flex flex-col gap-2 bg-white/[0.06] px-4 py-3.5">
					<span className="flex items-center gap-4 text-[15px] text-neutral-100">
						{theme === "light" ? (
							<Sun size={20} weight="light" />
						) : (
							<Moon size={20} weight="light" />
						)}
						Theme
					</span>
					<div className="grid grid-cols-4 gap-1">
						{THEMES.map((each) => (
							<button
								key={each.id}
								type="button"
								aria-pressed={theme === each.id}
								onClick={() => setTheme(each.id)}
								className={`py-2 text-[13px] transition-colors ${theme === each.id ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
							>
								{each.name}
							</button>
						))}
					</div>
				</div>
				{/* Which money is shown, live or paper: one at a time, never the two in one number. */}
				<div className="flex flex-col gap-2 bg-white/[0.06] px-4 py-3.5">
					<span className="text-[15px] text-neutral-100">Money shown</span>
					<div className="grid grid-cols-2 gap-1">
						{(["live", "paper"] as const).map((each) => (
							<button
								key={each}
								type="button"
								aria-pressed={side === each}
								onClick={() => setSide(each)}
								className={`py-2 text-[13px] transition-colors ${side === each ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
							>
								{each === "live" ? "Live" : "Paper"}
							</button>
						))}
					</div>
				</div>
				<Link to="/papers" className={tile}>
					<BookOpen size={20} weight="light" />
					<span className="flex-1">Papers</span>
				</Link>
				<Link to="/settings" className={tile}>
					<GearSix size={20} weight="light" />
					<span className="flex-1">Settings</span>
				</Link>
			</Section>
		</div>
	);
}
