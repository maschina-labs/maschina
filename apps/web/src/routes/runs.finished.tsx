import { CheckCircle } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/runs/finished")({
	component: () => (
		<Planned
			icon={CheckCircle}
			title="Finished runs"
			note="What every run did, and what it cost."
			will={[
				"Every run that completed, was skipped, or failed, newest first",
				"The trade it made, if it made one, with the price it got",
				"Why a skipped run was skipped, in the record's own words",
				"What it cost to send, so fee drag is a number rather than a feeling",
			]}
			waiting="the same cross-machine run route, and P&L per run"
		/>
	),
});
