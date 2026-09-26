import { Storefront } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Planned } from "../components/planned.tsx";

export const Route = createFileRoute("/marketplace/mine")({
	component: () => (
		<Planned
			icon={Storefront}
			title="My listings"
			note="Machines you have published for other people to run."
			will={[
				"Each definition you have published, and the version people are running",
				"How many copies are live, and how they are doing against your original",
				"What you have staked behind each one",
				"What you have earned from people running them",
			]}
			waiting="publishing, and the fee split that pays a creator"
		/>
	),
});
