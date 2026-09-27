import { Key } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/settings/keys")({
	component: () => (
		<Planned
			icon={Key}
			title="API keys"
			note="For talking to Maschina from your own code."
			will={[
				"Keys you can make, name and revoke, shown once and never again",
				"What each key may do, which is never more than you may do",
				"When each was last used, and from where",
				"The same interface machines are built on, so nothing is a special case",
			]}
			waiting="the SDK, and keys that are scoped rather than total"
		/>
	),
});
