import { createFileRoute, useRouter } from "@tanstack/react-router";
import { winRate } from "../components/marketplace.tsx";
import { Coming, Copy, Page, Part, Row } from "../components/page.tsx";
import { describeEvent } from "../lib/describe.ts";
import { amount, useMachine, useRecord } from "../lib/machines.ts";
import { largestDrop } from "../lib/track-record.ts";

export const Route = createFileRoute("/m/$machineId")({
	component: PublicMachine,
});

/**
 * A machine's public page, what a shared link opens (#477): what it is, what it made, and its whole record,
 * checkable by anyone, with nothing that can act. Readable by its owner now; by anyone once machines can
 * be marked public and a read-only route serves them.
 */
function PublicMachine() {
	const { machineId } = Route.useParams();
	const { api } = useRouter().options.context;
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	if (!machine.data) {
		return (
			<Page code={`PUBLIC // ${machineId.slice(0, 8).toUpperCase()}`} title="A MACHINE ON MASCHINA">
				<Coming>
					PUBLIC MACHINE PAGES, READABLE BY ANYONE, ARRIVE WITH THE BACKEND PASS. RIGHT NOW ONLY ITS
					OWNER CAN OPEN THIS.
				</Coming>
			</Page>
		);
	}
	const m = machine.data;
	const events = [...(record.data ?? [])];
	return (
		<Page
			code={`PUBLIC // ${m.kind.toUpperCase()} // ${m.result.simulated ? "PAPER" : "LIVE"}`}
			title={m.name.toUpperCase()}
		>
			<Part title="RESULTS">
				<Row term="REALISED" value={`${amount(m.result.realised)} USDC`} />
				<Row term="TRADES" value={String(m.result.trades)} />
				<Row term="WON" value={winRate(m)} />
				<Row
					term="LARGEST DROP"
					value={`${amount(largestDrop([...events].reverse()).toString())} USDC`}
				/>
			</Part>
			<Part title="ITS WALLET">
				<Copy>{m.walletAddress}</Copy>
				<Copy>ITS FUNDS CAN ONLY EVER GO BACK TO THE WALLET THAT MADE IT.</Copy>
			</Part>
			<Part title="ITS WHOLE RECORD">
				{events.map((entry) => (
					<Row
						key={entry.id}
						term={new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })}
						value={describeEvent(entry).title}
					/>
				))}
			</Part>
		</Page>
	);
}
