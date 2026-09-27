import { CurrencyDollar } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/wallet/balance")({
	component: () => (
		<Planned
			icon={CurrencyDollar}
			title="Balance"
			note="What you hold, across every machine."
			will={[
				"Every token held by you and by your machines, priced",
				"What is deployed into positions against what is sitting idle",
				"What has been swept out as profit and is no longer at risk",
				"A total that agrees with the chain rather than with this page",
			]}
			waiting="chain balances, and the float and sweep design in the parking lot"
		/>
	),
});
