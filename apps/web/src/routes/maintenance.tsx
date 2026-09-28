import { createFileRoute } from "@tanstack/react-router";
import { Copy, Page } from "../components/page.tsx";

export const Route = createFileRoute("/maintenance")({
	component: () => (
		<Page code="STATUS // MAINTENANCE" title="BACK SHORTLY">
			<Copy>
				MASCHINA IS BEING UPDATED. RUNNING MACHINES KEEP RUNNING THROUGH EVERY UPDATE: THIS PAUSES
				THE APP, NEVER YOUR MACHINES.
			</Copy>
		</Page>
	),
});
