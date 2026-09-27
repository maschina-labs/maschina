import { Wallet } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/wallet/")({
	component: () => (
		<Planned
			icon={Wallet}
			title="Wallet"
			note="Your wallet, and every machine wallet it owns."
			will={[
				"Your own balance, and the balance of each machine's wallet",
				"What each machine holds right now against what its budget says",
				"Funding a machine, and taking it back",
				"The policy on each machine wallet, in plain words rather than JSON",
			]}
			waiting="reading chain balances through the gateway"
		/>
	),
});
