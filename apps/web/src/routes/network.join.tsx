import { createFileRoute } from "@tanstack/react-router";
import { Coming, Copy, Later, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/network/join")({
	component: Join,
});

/** Running a node: what it asks of your computer, what it can never touch, and what it pays (stage C). */
function Join() {
	return (
		<Page code="NETWORK // JOIN" title="RUN A NODE">
			<Part title="WHAT IT DOES">
				<Copy>
					YOUR COMPUTER RUNS OTHER PEOPLE'S MACHINES AND IS PAID FOR IT. IT NEVER HOLDS THEIR MONEY:
					A NODE CAN ASK FOR A SIGNATURE AND NOTHING MORE, AND THE RULES DECIDE.
				</Copy>
			</Part>
			<Part title="WHAT IT NEEDS">
				<Row term="A COMPUTER THAT STAYS ON" value="-" />
				<Row term="AN INTERNET CONNECTION" value="-" />
				<Row term="THE MASCHINA DAEMON" value="-" />
			</Part>
			<Part title="WHAT IT PAYS">
				<Coming>SET IN STAGE C.</Coming>
			</Part>
			<Later>DOWNLOAD THE DAEMON</Later>
		</Page>
	);
}
