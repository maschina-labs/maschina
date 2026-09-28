import { createFileRoute, Link } from "@tanstack/react-router";
import { Coming, Copy, Page, Part, Row } from "../components/page.tsx";
import { useOperatingPicture } from "../components/portfolio.tsx";
import { describeEvent } from "../lib/describe.ts";

export const Route = createFileRoute("/wallet/")({
	component: Wallet,
});

/** Your wallet as Maschina sees it: what machines sent home, what is idle, and where to put it to work. */
function Wallet() {
	const picture = useOperatingPicture();
	const home = picture
		.flatMap(({ machine, record }) =>
			record
				.filter((entry) => entry.type === "withdrawal.completed")
				.map((entry) => ({ entry, name: machine.name })),
		)
		.sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt));
	return (
		<Page code="WALLET // HOME" title="YOUR WALLET">
			<Part title="WHAT CAME HOME">
				{home.length === 0 ? <Copy>NOTHING HAS BEEN WITHDRAWN YET.</Copy> : null}
				{home.map(({ entry, name }) => (
					<Row
						key={entry.id}
						term={`${new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })} · ${name.toUpperCase()}`}
						value={describeEvent(entry).title}
					/>
				))}
			</Part>
			<Part title="IDLE">
				<Row term="SOL" value="-" />
				<Row term="USDC" value="-" />
				<Coming>WHAT YOUR WALLET HOLDS, LIVE, ARRIVES WITH BALANCES IN THE BACKEND PASS.</Coming>
			</Part>
			<Part title="PUT IT TO WORK">
				<div className="flex flex-wrap gap-4 text-[11px] tracking-[0.14em]">
					<Link to="/new" className="text-neutral-200 hover:text-neutral-50">
						MAKE A MACHINE →
					</Link>
					<Link to="/swap" className="text-neutral-200 hover:text-neutral-50">
						SWAP →
					</Link>
					<Link to="/wallet/stake" className="text-neutral-200 hover:text-neutral-50">
						STAKE →
					</Link>
				</div>
			</Part>
		</Page>
	);
}
