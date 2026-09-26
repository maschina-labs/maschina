import { Storefront } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/marketplace/")({
	component: () => (
		<Planned
			icon={Storefront}
			title="Marketplace"
			note="Machines other people wrote, with the record to back them up."
			will={[
				"Published machine definitions, each pinned to an exact version",
				"The real record of the original, not a claim about it: every trade it made",
				"What the publisher has staked behind it, shown beside it",
				"One press to run your own copy, with your own budget and your own limits",
			]}
			waiting="publishing, copying and the bond that stands behind a listing"
		/>
	),
});
