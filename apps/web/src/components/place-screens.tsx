import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import { amount, useMachine, useMachines, useRecord } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { useSession } from "../lib/session.ts";
import { suggestionsFor } from "../lib/suggestions.ts";
import { largestDrop } from "../lib/track-record.ts";
import { sentence } from "./home.tsx";
import { Headline, Note, Onward, Panel, QUIET, Rows } from "./kit.tsx";

/**
 * The manager, and the places beyond your own machines: teams, the marketplace, the network, creators,
 * and a machine's public page. Most of these arrive with later stages, and say so; the manager and a
 * public machine work now.
 */

/** The share of finished round trips that made money, or nothing before the first one. */
export function winRate(machine: { result: { wins: number; losses: number } }): string {
	const done = machine.result.wins + machine.result.losses;
	return done === 0 ? "-" : `${Math.round((machine.result.wins / done) * 100)}%`;
}

const when = (at: string) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

/** The last part of the address: a team, listing, node, creator or machine's id. */
const lastPart = (path: string) => path.split("/").filter(Boolean).at(-1) ?? "";

export function ManagerScreen() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const [dismissed, setDismissed] = useState<Set<string>>(new Set());
	const mine = session.data ? (machines.data ?? []) : [];
	const suggestions = suggestionsFor(mine, price.data?.usd).filter(
		(each) => !dismissed.has(each.id),
	);
	return (
		<>
			<Panel size="big" name={`Worth a look · ${suggestions.length}`} scroll>
				{!session.data ? (
					<Note>Connect your wallet and the manager reads your machines for you.</Note>
				) : suggestions.length === 0 ? (
					<Note>Nothing needs you. Every machine is inside its band and none is stopped.</Note>
				) : (
					<ul className="flex flex-col gap-1.5">
						{suggestions.map((each) => (
							<li
								key={each.id}
								className="flex items-start justify-between gap-3 bg-white/[0.06] px-3 py-2.5"
							>
								<span className="flex flex-col gap-0.5">
									<span className="text-[15px] text-neutral-100">
										{sentence(each.machine)} · {sentence(each.title).toLowerCase()}
									</span>
									<span className="text-[13px] text-neutral-400">{sentence(each.detail)}</span>
								</span>
								<span className="flex shrink-0 gap-1">
									<Link
										to="/machines/$machineId"
										params={{ machineId: each.machineId }}
										className={QUIET}
									>
										Open
									</Link>
									<button
										type="button"
										onClick={() => setDismissed((was) => new Set([...was, each.id]))}
										className={QUIET}
									>
										Dismiss
									</button>
								</span>
							</li>
						))}
					</ul>
				)}
			</Panel>
			<Panel size="large" name="What it watches">
				<Rows
					rows={[
						["Price outside a band", "Retune, or switch"],
						["Down on what it holds", "With no floor"],
						["A stopped machine", "Withdraw, or retire"],
					]}
				/>
				<Note>Talking to your machines arrives with the AI manager.</Note>
			</Panel>
		</>
	);
}

export function TeamsScreen() {
	return (
		<>
			<Panel size="big" name="Your teams">
				<Headline>None yet</Headline>
				<Note>
					A team is several machines with one purpose and one shared budget, talking in one
					conversation. You talk to the team, not each machine.
				</Note>
			</Panel>
			<Panel size="large" name="Arriving">
				<Note>Teams arrive after the AI manager.</Note>
			</Panel>
		</>
	);
}

export function TeamScreen() {
	return (
		<>
			<Panel size="big" name="Conversation">
				<Note>The team's conversation, with you in it.</Note>
			</Panel>
			<Panel size="large" name="Machines and budgets">
				<Note>Its machines, what each is doing, what each may spend and what is left.</Note>
			</Panel>
		</>
	);
}

export function ListingScreen() {
	return (
		<>
			<Panel size="big" name="A published machine">
				<Headline>What it does</Headline>
				<Note>Its kind, its settings and what it earns from, as its creator published it.</Note>
			</Panel>
			<Panel size="large" name="Track record">
				<Rows
					rows={[
						["Return", "-"],
						["Largest drop", "-"],
						["Against just holding", "-"],
						["Trades", "-"],
					]}
				/>
				<Note>Publishing and copying arrive with the marketplace.</Note>
			</Panel>
		</>
	);
}

export function NodeScreen() {
	return (
		<>
			<Panel
				size="big"
				name={`Node ${lastPart(useRouterState({ select: (s) => s.location.pathname })).slice(0, 8)}`}
			>
				<Rows
					rows={[
						["Up for", "-"],
						["Where", "-"],
						["Runs taken", "-"],
					]}
				/>
			</Panel>
			<Panel size="large" name="What it ran and earned">
				<Note>Every run it took, and what it earned, once nodes are paid for their work.</Note>
			</Panel>
		</>
	);
}

export function JoinScreen() {
	return (
		<>
			<Panel size="big" name="Run a node">
				<Headline>Your computer, paid to run machines</Headline>
				<Note>
					It never holds anyone's money: a node can ask for a signature and nothing more, and the
					rules decide.
				</Note>
			</Panel>
			<Panel size="large" name="What it needs">
				<Rows
					rows={[
						["A computer that stays on", "Yes"],
						["An internet connection", "Yes"],
						["The Maschina daemon", "Arriving"],
					]}
				/>
				<Onward to="/papers">How the network works</Onward>
			</Panel>
		</>
	);
}

export function CreatorScreen() {
	const handle = lastPart(useRouterState({ select: (s) => s.location.pathname }));
	return (
		<>
			<Panel size="big" name={`@${handle}`}>
				<Headline>Published machines</Headline>
				<Note>Their machines, each with its track record.</Note>
			</Panel>
			<Panel size="large" name="What copies earned">
				<Rows
					rows={[
						["Copies running", "-"],
						["Earned from copies", "-"],
					]}
				/>
				<Note>Creator pages arrive with the marketplace.</Note>
			</Panel>
		</>
	);
}

/** What a shared link to a machine opens: what it is, what it made, and its whole record. Nothing acts. */
export function PublicMachineScreen() {
	const { api } = useRouter().options.context;
	const machineId = lastPart(useRouterState({ select: (s) => s.location.pathname }));
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const m = machine.data;
	if (!m) {
		return (
			<Panel size="big" name="A machine on Maschina">
				<Note>
					Public machine pages, readable by anyone, arrive soon. Right now only a machine's owner
					can open this.
				</Note>
			</Panel>
		);
	}
	const events = [...(record.data ?? [])];
	return (
		<>
			<Panel size="large" name={`${m.name} · ${m.result.simulated ? "paper" : "live"}`}>
				<Rows
					rows={[
						["Realized", `${amount(m.result.realised)} USDC`],
						["Trades", String(m.result.trades)],
						["Won", winRate(m)],
						["Largest drop", `${amount(largestDrop([...events].reverse()).toString())} USDC`],
					]}
				/>
			</Panel>
			<Panel size="big" name={`Its whole record · ${events.length}`} scroll>
				<ol className="flex flex-col">
					{events.map((entry) => (
						<li
							key={entry.id}
							className="grid grid-cols-[auto_1fr] gap-x-5 border-white/[0.06] border-b py-2.5"
						>
							<time className="text-[13px] text-neutral-500 tabular-nums">
								{when(entry.occurredAt)}
							</time>
							<span className="truncate text-[15px] text-neutral-100">
								{sentence(describeEvent(entry).title)}
							</span>
						</li>
					))}
				</ol>
			</Panel>
			<Panel size="wide" name="Its wallet">
				<p className="break-all font-mono text-[12px] text-neutral-300">{m.walletAddress}</p>
				<Note>Its money can only ever go back to the wallet that made it.</Note>
			</Panel>
		</>
	);
}

export function MaintenanceScreen() {
	return (
		<Panel size="big" name="Maintenance">
			<Headline>Back shortly</Headline>
			<Note>
				Maschina is being updated. Running machines keep running through every update: this pauses
				the app, never your machines.
			</Note>
		</Panel>
	);
}
