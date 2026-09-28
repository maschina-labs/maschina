import { BookOpen, GearSix, Robot } from "@phosphor-icons/react";
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
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
			<Link to="/machines" className={`${LABEL} hover:text-neutral-100`}>
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

const RAIL = "hidden shrink-0 lg:block";
const INSIDE = "flex flex-col gap-10 px-5 py-6";

/** A darker panel than the header's glass, so a column of text reads clearly over the moving fog. */
/** The docs and the whitepaper live in their own app, not this one. */
export const DOCS = "https://docs.maschina.dev";

const PANEL = "bg-[oklch(0.1_0_0/0.55)] backdrop-saturate-0";
const ICON =
	"grid size-9 place-items-center text-neutral-500 transition-colors hover:text-neutral-100";

/**
 * The left side, like VS Code: a thin rail of icons on its outer edge, and a panel beside it that the
 * machines icon opens and closes. Docs and settings are pages, so their icons go to them; settings sits
 * at the bottom, where people look for it.
 */
export function LeftRail() {
	const [open, setOpen] = useState(true);
	return (
		<div className="hidden shrink-0 gap-1.5 lg:flex">
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
				{/* Docs are their own app, so this leaves Maschina for them. */}
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

export function RightRail() {
	return (
		<aside aria-label="Right" className={`w-72 ${RAIL}`}>
			<ScrollArea className={INSIDE}>
				<section aria-label="Live" className="flex flex-col gap-4">
					<h2 className={LABEL}>LIVE</h2>
					<Live />
				</section>
			</ScrollArea>
		</aside>
	);
}
