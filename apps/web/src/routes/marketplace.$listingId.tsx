import { createFileRoute } from "@tanstack/react-router";
import { Coming, Copy, Later, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/marketplace/$listingId")({
	component: Listing,
});

/** One published machine: what it does, its track record, and copying it with your own limits (A7). */
function Listing() {
	const { listingId } = Route.useParams();
	return (
		<Page
			code={`MARKETPLACE // LISTING ${listingId.slice(0, 8).toUpperCase()}`}
			title="A PUBLISHED MACHINE"
		>
			<Part title="WHAT IT DOES">
				<Coming>ITS KIND, ITS SETTINGS AND WHAT IT EARNS FROM, AS ITS CREATOR PUBLISHED IT.</Coming>
			</Part>
			<Part title="TRACK RECORD">
				<Row term="RETURN" value="-" />
				<Row term="LARGEST DROP" value="-" />
				<Row term="AGAINST JUST HOLDING" value="-" />
				<Row term="TRADES" value="-" />
				<Coming>EVERY FIGURE LINKS TO THE RECORD THAT PRODUCED IT.</Coming>
			</Part>
			<Part title="COPY IT">
				<Copy>
					YOUR OWN COPY, WITH YOUR OWN BUDGET AND LIMITS. THE CREATOR EARNS A SHARE OF WHAT IT
					MAKES.
				</Copy>
				<Later>COPY THIS MACHINE</Later>
			</Part>
			<Coming>PUBLISHING AND COPYING ARRIVE WITH THE MARKETPLACE (A7).</Coming>
		</Page>
	);
}
