import { Bell, BookOpen, ChatsCircle, GearSix, Pulse, Robot, Sparkle } from "@phosphor-icons/react";
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { alertsFrom, lastSeen, markSeen, unread } from "../lib/alerts.ts";
import { describeEvent } from "../lib/describe.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { ChatPanel } from "./chat-panel.tsx";
import { GLASS, GLASS_ACTIVE } from "./glass.ts";
import { useActivity } from "./portfolio.tsx";
import { ScrollArea } from "./scroll-ticks.tsx";

/**
 * The two sidebars, as plain text floating on the fog like the columns in Ash's reference: your machines
 * on the left, which also choose the one the terminal follows, and what they are doing on the right. No
 * panel, no bars, no hairlines. Each scrolls on its own.
 */

const LABEL = "text-[11px] text-neutral-500 tracking-[0.12em]";

/** Floating text: a small grey line, a white title, grey detail under it. */
function Note({ top, title, detail }: { top: string; title: string; detail?: string }) {
	return (
		<div className="flex flex-col gap-2 text-[11px] tracking-[0.1em]">
			<span className="text-neutral-500 tabular-nums">{top}</span>
			<span className="text-neutral-100">{title}</span>
			{detail ? <span className="text-neutral-500">{detail}</span> : null}
		</div>
	);
}

function Machines() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	// The machine the terminal follows, named in the address so a link to it is a link to that view.
	const { machine: chosen } = useSearch({ strict: false }) as { machine?: string };
	if (!session.data) return <p className={LABEL}>CONNECT TO SEE YOUR MACHINES</p>;
	return (
		<div className="flex flex-col gap-6">
			{(machines.data ?? []).map((machine) => (
				<Link
					key={machine.machineId}
					to="/"
					search={{ machine: machine.machineId }}
					aria-current={machine.machineId === chosen}
					className={`transition-opacity hover:opacity-100 ${machine.machineId === chosen ? "opacity-100" : "opacity-60"}`}
				>
					<Note
						top={machine.kind.toUpperCase()}
						title={machine.name.toUpperCase()}
						detail={machine.state.toUpperCase()}
					/>
				</Link>
			))}
			<Link to="/new" className={`${LABEL} hover:text-neutral-100`}>
				+ NEW MACHINE
			</Link>
		</div>
	);
}

function Live() {
	const feed = useActivity().slice(0, 12);
	if (feed.length === 0) return <p className={LABEL}>NOTHING YET</p>;
	return (
		<div className="flex flex-col gap-6">
			{feed.map((entry) => (
				<Note
					key={entry.id}
					top={`${new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })} · ${entry.machineName.toUpperCase()}`}
					title={describeEvent(entry).title}
					detail={describeEvent(entry).detail}
				/>
			))}
		</div>
	);
}

const INSIDE = "flex flex-col gap-10 px-5 py-6";

/** A darker panel than the header's glass, so a column of text reads clearly over the moving fog. */
/** The docs and the whitepaper live in their own app, not this one. */
export const DOCS = "https://docs.maschina.dev";

const PANEL = "bg-[oklch(0.1_0_0/0.55)] backdrop-saturate-0";
const ICON =
	"grid size-7 place-items-center text-neutral-500 transition-colors hover:text-neutral-100";

/**
 * The left side, like VS Code: a thin rail of icons on its outer edge, and a panel beside it that the
 * machines icon opens and closes. Docs and settings are pages, so their icons go to them; settings sits
 * at the bottom, where people look for it.
 */
/**
 * The left side, like JetBrains: a rail of icons attached to the edge of the screen, and the tool window
 * it opens attached to that, with no gaps. Docs are their own app, so that icon leaves for them; settings
 * sits at the bottom, where people look for it.
 */
export function LeftRail() {
	const [open, setOpen] = useState(true);
	return (
		<div className="hidden shrink-0 lg:flex">
			<nav aria-label="Tools" className={`flex w-11 flex-col items-center gap-1 py-1.5 ${GLASS}`}>
				<button
					type="button"
					aria-label="Your machines"
					title="Your machines"
					aria-pressed={open}
					onClick={() => setOpen((was) => !was)}
					className={`${ICON} ${open ? `text-neutral-100 ${GLASS_ACTIVE}` : ""}`}
				>
					<Robot size={18} weight="light" />
				</button>
				<Link
					to="/manager"
					aria-label="Manager"
					title="Manager"
					className={ICON}
					activeProps={{ className: `text-neutral-100 ${GLASS_ACTIVE}` }}
				>
					<Sparkle size={18} weight="light" />
				</Link>
				<a
					href={DOCS}
					target="_blank"
					rel="noreferrer"
					aria-label="Docs"
					title="Docs"
					className={ICON}
				>
					<BookOpen size={18} weight="light" />
				</a>
				<div className="flex-1" />
				<Link
					to="/settings"
					aria-label="Settings"
					title="Settings"
					className={ICON}
					activeProps={{ className: `text-neutral-100 ${GLASS_ACTIVE}` }}
				>
					<GearSix size={18} weight="light" />
				</Link>
			</nav>
			{open ? (
				<aside aria-label="Left" className={`w-64 ${PANEL}`}>
					<ScrollArea className={INSIDE}>
						<section aria-label="Your machines" className="flex flex-col gap-4">
							<h2 className={LABEL}>YOUR MACHINES</h2>
							<Machines />
						</section>
					</ScrollArea>
				</aside>
			) : null}
		</div>
	);
}

/**
 * The right side, the mirror of the left: a rail of icons attached to the edge, opening the live feed or
 * chat as a tool window beside it. One is open at a time; pressing the open one closes it.
 */
export function RightRail() {
	const [open, setOpen] = useState<"live" | "chat" | "alerts" | undefined>("live");
	const toggle = (tool: "live" | "chat" | "alerts") =>
		setOpen((was) => (was === tool ? undefined : tool));
	const alerts = alertsFrom(useActivity());
	const [seenAt, setSeenAt] = useState(lastSeen);
	const fresh = open === "alerts" ? 0 : unread(alerts, seenAt);
	// Opening the alerts is looking at them: everything up to now counts as seen.
	const openAlerts = () => {
		const now = new Date().toISOString();
		markSeen(now);
		setSeenAt(now);
		toggle("alerts");
	};
	return (
		<div className="hidden shrink-0 lg:flex">
			{open === "live" ? (
				<aside aria-label="Right" className={`w-72 ${PANEL}`}>
					<ScrollArea className={INSIDE}>
						<section aria-label="Live" className="flex flex-col gap-4">
							<h2 className={LABEL}>LIVE</h2>
							<Live />
						</section>
					</ScrollArea>
				</aside>
			) : null}
			{open === "alerts" ? (
				<aside aria-label="Alerts" className={`w-72 ${PANEL}`}>
					<ScrollArea className={INSIDE}>
						<section aria-label="Alerts list" className="flex flex-col gap-4">
							<h2 className={LABEL}>ALERTS</h2>
							{alerts.length === 0 ? <p className={LABEL}>NOTHING TO TELL YOU YET</p> : null}
							<div className="flex flex-col gap-6">
								{alerts.slice(0, 30).map((entry) => (
									<Note
										key={entry.id}
										top={`${new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })} · ${entry.machineName.toUpperCase()}`}
										title={describeEvent(entry).title}
										detail={describeEvent(entry).detail}
									/>
								))}
							</div>
						</section>
					</ScrollArea>
				</aside>
			) : null}
			{open === "chat" ? (
				<aside aria-label="Chat window" className={`w-[380px] ${PANEL}`}>
					<ChatPanel docked onClose={() => setOpen(undefined)} />
				</aside>
			) : null}
			<nav
				aria-label="Right tools"
				className={`flex w-11 flex-col items-center gap-1 py-1.5 ${GLASS}`}
			>
				<button
					type="button"
					aria-label="Live"
					title="Live"
					aria-pressed={open === "live"}
					onClick={() => toggle("live")}
					className={`${ICON} ${open === "live" ? `text-neutral-100 ${GLASS_ACTIVE}` : ""}`}
				>
					<Pulse size={18} weight="light" />
				</button>
				<button
					type="button"
					aria-label={fresh > 0 ? `Alerts, ${fresh} new` : "Alerts"}
					title="Alerts"
					aria-pressed={open === "alerts"}
					onClick={openAlerts}
					className={`relative ${ICON} ${open === "alerts" ? `text-neutral-100 ${GLASS_ACTIVE}` : ""}`}
				>
					<Bell size={18} weight="light" />
					{fresh > 0 ? (
						<span className="absolute top-0.5 right-0.5 min-w-3.5 bg-neutral-100 px-0.5 text-center text-[8.5px] text-neutral-950 leading-[14px]">
							{fresh > 9 ? "9+" : fresh}
						</span>
					) : null}
				</button>
				<button
					type="button"
					aria-label="Chat"
					title="Chat"
					aria-pressed={open === "chat"}
					onClick={() => toggle("chat")}
					className={`${ICON} ${open === "chat" ? `text-neutral-100 ${GLASS_ACTIVE}` : ""}`}
				>
					<ChatsCircle size={18} weight="light" />
				</button>
			</nav>
		</div>
	);
}
