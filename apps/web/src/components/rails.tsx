import { Link, useRouter } from "@tanstack/react-router";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { useActivity } from "./portfolio.tsx";

/**
 * The one sidebar, on the right: your machines, then what they are doing, as plain text floating on the
 * fog like the columns in Ash's reference. No panel, no bars, no hairlines. It scrolls on its own.
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
	if (!session.data) return <p className={LABEL}>CONNECT TO SEE YOUR MACHINES</p>;
	return (
		<div className="flex flex-col gap-6">
			{(machines.data ?? []).map((machine) => (
				<Link
					key={machine.machineId}
					to="/machines/$machineId"
					params={{ machineId: machine.machineId }}
					className="opacity-80 transition-opacity hover:opacity-100"
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
					top={new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
					title={entry.type.replace(".", " ").toUpperCase()}
					detail={entry.machineName.toUpperCase()}
				/>
			))}
		</div>
	);
}

export function RightRail() {
	return (
		<aside
			aria-label="Right"
			className="hidden w-72 shrink-0 flex-col gap-10 overflow-y-auto overscroll-none px-5 py-6 lg:flex"
		>
			<section aria-label="Your machines" className="flex flex-col gap-4">
				<h2 className={LABEL}>YOUR MACHINES</h2>
				<Machines />
			</section>
			<section aria-label="Live" className="flex flex-col gap-4">
				<h2 className={LABEL}>LIVE</h2>
				<Live />
			</section>
		</aside>
	);
}
