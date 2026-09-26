import { GlobeHemisphereWest } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/network")({
	component: () => (
		<Planned
			icon={GlobeHemisphereWest}
			title="Network"
			note="The computers that run machines."
			will={[
				"Every node, where it is, and how quickly its trades land",
				"What each one is running right now",
				"How to run one yourself, and what it earns",
				"Why an untrusted node is harmless: it proposes, and it holds nothing",
			]}
			waiting="nodes owned by somebody other than Maschina"
		/>
	),
});
