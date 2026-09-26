import { ClockCounterClockwise } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/runs/queued")({
	component: () => (
		<Planned
			icon={ClockCounterClockwise}
			title="Queued runs"
			note="Work that is waiting for a node to pick it up."
			will={[
				"Every run due now or soon, across all of your machines",
				"Which machine each one belongs to, and why it was queued",
				"The level that woke it, for a machine waiting on more than one",
				"How long it has been waiting, so a stuck queue is obvious",
			]}
			waiting="a route that lists runs across machines rather than one machine at a time"
		/>
	),
});
