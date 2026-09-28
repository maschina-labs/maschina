import { createFileRoute } from "@tanstack/react-router";
import { Coming, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/u/$handle")({
	component: Creator,
});

/** A creator: the machines they published, and what copies of them earned (A7). */
function Creator() {
	const { handle } = Route.useParams();
	return (
		<Page code="CREATOR" title={`@${handle.toUpperCase()}`}>
			<Part title="PUBLISHED MACHINES">
				<Coming>THEIR MACHINES, EACH WITH ITS TRACK RECORD.</Coming>
			</Part>
			<Part title="WHAT COPIES EARNED THEM">
				<Row term="COPIES RUNNING" value="-" />
				<Row term="EARNED FROM COPIES" value="-" />
			</Part>
			<Coming>CREATOR PAGES ARRIVE WITH THE MARKETPLACE (A7).</Coming>
		</Page>
	);
}
