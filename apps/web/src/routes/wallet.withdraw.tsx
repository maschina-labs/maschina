import { ArrowsLeftRight } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/wallet/withdraw")({
	component: () => (
		<Planned
			icon={ArrowsLeftRight}
			title="Withdrawal"
			note="Taking a machine's funds back."
			will={[
				"Pick a machine, pick an amount, and it goes to the wallet that made it",
				"Nowhere else is possible: the destination is looked up, never typed",
				"The machine is stopped first, so nothing is signed while funds are moving",
				"Every withdrawal in the record, from asked for to landed",
			]}
			waiting="the gateway route in front of the one the signer already has"
		/>
	),
});
