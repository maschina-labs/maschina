import { createFileRoute } from "@tanstack/react-router";
import { Coming, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/network/$nodeId")({
	component: Node,
});

/** One node: what it ran, how long it has been up, and what it earned. */
function Node() {
	const { nodeId } = Route.useParams();
	return (
		<Page code={`NETWORK // NODE ${nodeId.slice(0, 8).toUpperCase()}`} title="A NODE">
			<Part title="STATUS">
				<Row term="UP FOR" value="-" />
				<Row term="WHERE" value="-" />
				<Row term="RUNS TAKEN" value="-" />
			</Part>
			<Part title="WHAT IT RAN">
				<Coming>EVERY RUN IT TOOK, WHICH MACHINE, AND HOW IT ENDED.</Coming>
			</Part>
			<Part title="WHAT IT EARNED">
				<Coming>FROM STAGE C, WHEN NODES ARE PAID FOR THEIR WORK.</Coming>
			</Part>
		</Page>
	);
}
