import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Shell } from "../components/shell.tsx";
import { amount, useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

export const Route = createFileRoute("/")({
	component: Machines,
});

const TONE: Record<string, string> = {
	running: "bg-success",
	paused: "bg-warning",
	ready: "bg-info",
	draft: "bg-muted-foreground/40",
	stopped: "bg-muted-foreground/40",
};

function Machines() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);

	return (
		<Shell>
			<div className="mx-auto w-full max-w-[1100px] px-8 py-8">
				<div className="mb-6 flex items-baseline justify-between">
					<h1 className="font-medium text-[20px] tracking-tight">Machines</h1>
					<Link
						to="/new"
						className="rounded-lg bg-primary px-3 py-1.5 font-medium text-[13px] text-primary-foreground"
					>
						New machine
					</Link>
				</div>

				{!session.data ? (
					<p className="text-muted-foreground text-sm">Connect your wallet to see your machines.</p>
				) : machines.isPending ? (
					<p className="text-muted-foreground text-sm">Loading.</p>
				) : machines.error ? (
					<p className="text-destructive text-sm">{machines.error.message}</p>
				) : machines.data.length === 0 ? (
					<div className="rounded-xl border border-border/60 border-dashed p-10 text-center">
						<p className="text-sm">No machines yet.</p>
						<p className="mx-auto mt-1.5 max-w-sm text-muted-foreground text-[13px]">
							A machine does one job with money you set aside for it.
						</p>
					</div>
				) : (
					<div className="overflow-hidden rounded-xl border border-border/60">
						{machines.data.map((machine) => (
							<Link
								key={machine.machineId}
								to="/machines/$machineId"
								params={{ machineId: machine.machineId }}
								className="flex items-center gap-5 border-border/40 border-b px-4 py-3 last:border-0 hover:bg-white/[0.015]"
							>
								<span
									className={`size-2 shrink-0 rounded-full ${TONE[machine.state] ?? "bg-muted"}`}
								/>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[13px]">{machine.name}</span>
									<span className="block truncate text-[12px] text-muted-foreground/60">
										{machine.kind} · {machine.state}
										{machine.stateReason ? ` · ${machine.stateReason}` : ""}
									</span>
								</span>
								<span className="text-right">
									<span className="block font-mono text-[13px] tabular-nums">
										{amount(machine.budget.available)}
									</span>
									<span className="block text-[11px] text-muted-foreground/60">left to spend</span>
								</span>
							</Link>
						))}
					</div>
				)}
			</div>
		</Shell>
	);
}
