import { Link } from "@tanstack/react-router";
import { amount, type MachineSummary } from "../lib/machines.ts";

/**
 * Every machine as a compact cell along the top of the terminal, numbered like slots on a panel:
 * `01 // RANGE FINDER`, its state and its result. The one the instrument follows is lit; pressing
 * another loads it.
 */
export function FleetStrip({
	machines,
	following,
}: {
	machines: MachineSummary[];
	following: string | undefined;
}) {
	if (machines.length === 0) return null;
	return (
		<nav aria-label="Fleet" className="flex gap-px overflow-x-auto">
			{machines.map((machine, index) => {
				const lit = machine.machineId === following;
				return (
					<Link
						key={machine.machineId}
						to="/"
						search={{ machine: machine.machineId }}
						aria-current={lit}
						className={`flex min-w-44 shrink-0 flex-col gap-1.5 px-3.5 py-2.5 transition-colors ${
							lit ? "bg-[oklch(1_0_0/0.09)]" : "bg-[oklch(1_0_0/0.03)] hover:bg-[oklch(1_0_0/0.06)]"
						}`}
					>
						<span className="text-[9.5px] text-neutral-500 tabular-nums tracking-[0.14em]">
							{String(index + 1).padStart(2, "0")} {"//"} {machine.kind.toUpperCase()}
						</span>
						<span
							className={`truncate text-[11.5px] tracking-[0.12em] ${lit ? "text-neutral-100" : "text-neutral-300"}`}
						>
							{machine.name.toUpperCase()}
						</span>
						<span className="flex justify-between gap-3 text-[9.5px] text-neutral-500 tabular-nums tracking-[0.12em]">
							<span>{machine.state.toUpperCase()}</span>
							<span className="text-neutral-300">{amount(machine.result.realised)}</span>
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
