import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { describeEvent } from "../lib/describe.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { useActivity } from "./portfolio.tsx";

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

const RAIL = "hidden shrink-0 flex-col gap-10 overflow-y-auto overscroll-none px-5 py-6 lg:flex";

export function LeftRail() {
	return (
		<aside aria-label="Left" className={`w-64 ${RAIL}`}>
			<section aria-label="Your machines" className="flex flex-col gap-4">
				<h2 className={LABEL}>YOUR MACHINES</h2>
				<Machines />
			</section>
		</aside>
	);
}

export function RightRail() {
	return (
		<aside aria-label="Right" className={`w-72 ${RAIL}`}>
			<section aria-label="Live" className="flex flex-col gap-4">
				<h2 className={LABEL}>LIVE</h2>
				<Live />
			</section>
		</aside>
	);
}
