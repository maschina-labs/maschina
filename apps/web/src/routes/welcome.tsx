import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Coming, Copy, Page, Part, Row } from "../components/page.tsx";
import { TypeRow } from "../components/slider-row.tsx";

export const Route = createFileRoute("/welcome")({
	component: Welcome,
});

/**
 * The front door (FRONT-DOOR.md, #224): one line of what it is, the numbers from the record, the guarantee,
 * and one button in. No invented numbers: until the public figures are served, they say so.
 */
function Welcome() {
	const [email, setEmail] = useState("");
	return (
		<Page
			code="MASCHINA"
			title="GIVE SOFTWARE A JOB AND MONEY, SAFELY, SO IT CAN GO TO WORK FOR YOU."
		>
			<Part title="FROM THE RECORD">
				<Row term="MACHINES RUNNING" value="-" />
				<Row term="TRADES RECORDED" value="-" />
				<Row term="TRADES REFUSED BY THE RULES" value="-" />
				<Coming>
					LIVE FIGURES ACROSS EVERY PUBLIC MACHINE, EACH ONE CLICKABLE TO THE RECORD THAT PRODUCED
					IT, ARRIVE WITH THE BACKEND PASS.
				</Coming>
			</Part>
			<Part title="THE GUARANTEE">
				<Copy>
					A MACHINE CAN SPEND WHAT YOU GIVE IT AND NOTHING MORE, AND ITS FUNDS CAN ONLY EVER REACH
					THE WALLET THAT MADE IT.
				</Copy>
			</Part>
			<Link
				to="/"
				className="self-start border border-white/40 px-6 py-3 text-[12px] text-neutral-100 tracking-[0.16em] hover:bg-white/[0.08]"
			>
				OPEN THE APP →
			</Link>
			<Part title="THE WAITLIST">
				<div className="flex max-w-[420px] flex-col gap-1.5">
					<TypeRow label="EMAIL" value={email} onChange={setEmail} />
				</div>
				<button
					type="button"
					disabled
					className="h-10 self-start border border-white/20 px-5 text-[11px] text-neutral-300 tracking-[0.14em] disabled:opacity-40"
				>
					JOIN THE WAITLIST
				</button>
				<Coming>THE WAITLIST OPENS WITH THE BETA (#211).</Coming>
			</Part>
		</Page>
	);
}
