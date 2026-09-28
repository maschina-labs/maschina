import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coming, Copy, Later, Page, Part } from "../components/page.tsx";
import { TypeRow } from "../components/slider-row.tsx";

export const Route = createFileRoute("/invite")({
	component: Invite,
});

/** Joining the private beta with an invite code (#210). */
function Invite() {
	const [code, setCode] = useState("");
	return (
		<Page code="BETA // INVITE" title="YOU'RE INVITED">
			<Part title="YOUR CODE">
				<div className="flex max-w-[420px] flex-col gap-1.5">
					<TypeRow label="INVITE CODE" value={code} onChange={setCode} />
				</div>
				<Later>JOIN THE BETA</Later>
				<Copy>
					BETA MACHINES CAN HOLD A LIMITED AMOUNT WHILE EVERYTHING IS PROVEN WITH REAL PEOPLE.
				</Copy>
				<Coming>INVITE CODES ARRIVE WITH THE PRIVATE BETA (#210).</Coming>
			</Part>
		</Page>
	);
}
