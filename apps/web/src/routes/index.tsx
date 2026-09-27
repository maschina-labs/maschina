/**
 * Every machine you own, as one table.
 *
 * Ordered by nothing clever: the record's order, newest last, because a list that reorders itself while
 * you read it is a list you cannot trust. Each row carries the two numbers somebody actually wants from a
 * glance, which are what it has left to spend and what it has made, and nothing else.
 */

import { Plus, Pulse, Wallet } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ForError } from "../components/for-error.tsx";
import { Shell } from "../components/shell.tsx";
import { Button, Empty, Loading, PageHead, Pill } from "../components/ui.tsx";
import { amount, type MachineSummary, useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

export const Route = createFileRoute("/")({
	component: Machines,
});

function MachineRow({ machine }: { machine: MachineSummary }) {
	const live = machine.state === "running";
	const lost = machine.result.realised.startsWith("-");
	const made = machine.result.realised !== "0";

	return (
		<Link
			to="/machines/$machineId"
			params={{ machineId: machine.machineId }}
			className="group flex items-center gap-4 border-line/50 border-b px-7 py-3 transition-colors duration-150 last:border-0 hover:bg-surface"
		>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-2">
					<span className="truncate font-medium text-[13px] text-text">{machine.name}</span>
					<Pill tone={live ? "live" : "quiet"} dot={live}>
						{machine.state}
					</Pill>
					{machine.result.simulated ? <Pill tone="quiet">paper</Pill> : null}
				</span>
				<span className="mt-0.5 flex items-center gap-2 font-mono text-[11.5px] text-text-faint">
					<span>{machine.kind}</span>
					<span className="text-line-strong">·</span>
					<span className="truncate">
						{`${machine.walletAddress.slice(0, 4)}…${machine.walletAddress.slice(-4)}`}
					</span>
					{machine.stateReason ? (
						<>
							<span className="text-line-strong">·</span>
							<span className="truncate font-sans text-text-muted">{machine.stateReason}</span>
						</>
					) : null}
				</span>
			</span>

			<span className="hidden w-[104px] shrink-0 text-right font-mono text-[13px] text-text sm:block">
				{amount(machine.budget.available)}
			</span>

			<span
				className={`w-[104px] shrink-0 text-right font-mono text-[13px] ${
					lost ? "text-danger-text" : made ? "text-accent-text" : "text-text-faint"
				}`}
			>
				{amount(machine.result.realised)}
			</span>
		</Link>
	);
}

function Machines() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);

	return (
		<Shell>
			<PageHead
				title="Machines"
				note="Each one does a single job with money you set aside for it, and nothing else."
				actions={
					<Link to="/new">
						<Button tone="primary" icon={Plus}>
							New machine
						</Button>
					</Link>
				}
			/>

			{!session.data ? (
				<Empty
					icon={Wallet}
					title="Connect a wallet to see your machines"
					note="Signing in proves the wallet is yours. Maschina never holds your keys, and a machine can only ever pay the wallet that made it."
				/>
			) : machines.isPending ? (
				<Loading rows={4} />
			) : machines.error ? (
				<ForError
					error={machines.error}
					title="Your machines could not be read"
					retry={() => machines.refetch()}
				/>
			) : machines.data.length === 0 ? (
				<Empty
					icon={Pulse}
					title="No machines yet"
					note="A machine is a job, a budget and a set of limits. It can spend what you give it and nothing more, and everything it does is written down."
					action={
						<Link to="/new">
							<Button tone="primary" icon={Plus}>
								Make the first one
							</Button>
						</Link>
					}
				/>
			) : (
				<div className="mx-auto w-full max-w-[1180px]">
					{/* Labelled once, at the top, rather than under every number. */}
					<div className="flex items-center gap-4 border-line/50 border-b px-7 py-2 text-[10px] text-text-faint uppercase tracking-[0.08em]">
						<span className="min-w-0 flex-1">Machine</span>
						<span className="hidden w-[104px] shrink-0 text-right sm:block">Left to spend</span>
						<span className="w-[104px] shrink-0 text-right">Made</span>
					</div>
					{machines.data.map((machine) => (
						<MachineRow key={machine.machineId} machine={machine} />
					))}
				</div>
			)}
		</Shell>
	);
}
