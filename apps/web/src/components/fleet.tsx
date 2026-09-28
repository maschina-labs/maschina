import { Link, useRouter } from "@tanstack/react-router";
import { type MachineSummary, useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { Loading } from "./loading.tsx";

/** Plain for now: exposed first, arranged and styled once everything is on the page. */
export function FleetView({
	machines,
	selected,
	onSelect,
}: {
	machines: MachineSummary[];
	selected: string | undefined;
	onSelect: (machineId: string) => void;
}) {
	if (machines.length === 0) {
		return (
			<p className="text-[12px] text-neutral-500">
				NO MACHINES YET ·{" "}
				<Link to="/new" className="text-neutral-200 hover:text-neutral-50">
					MAKE A PAPER ONE, IT'S FREE →
				</Link>
			</p>
		);
	}
	return (
		<ul aria-label="Your machines" className="flex flex-col">
			{machines.map((machine) => (
				<li key={machine.machineId}>
					<button
						type="button"
						onClick={() => onSelect(machine.machineId)}
						aria-current={machine.machineId === selected}
						className={`flex w-full items-baseline justify-between gap-3 border-white/[0.06] border-b py-2.5 text-left text-[12px] ${
							machine.machineId === selected
								? "text-neutral-100"
								: "text-neutral-500 hover:text-neutral-300"
						}`}
					>
						<span className="truncate">{machine.name}</span>
						<span className="shrink-0 text-[11px]">{machine.state.toUpperCase()}</span>
					</button>
				</li>
			))}
		</ul>
	);
}

export function Fleet({
	selected,
	onSelect,
}: {
	selected: string | undefined;
	onSelect: (machineId: string) => void;
}) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);

	if (!session.data)
		return <p className="text-[12px] text-neutral-500">CONNECT TO SEE YOUR MACHINES</p>;
	if (machines.error)
		return (
			<p role="alert" className="text-[12px] text-neutral-500">
				{machines.error.message}
			</p>
		);
	if (!machines.data) return <Loading what="LOADING MACHINES" />;
	return <FleetView machines={machines.data} selected={selected} onSelect={onSelect} />;
}
