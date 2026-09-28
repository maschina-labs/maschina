import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coming, Page, Part } from "../components/page.tsx";
import { Toggle } from "../components/settings.tsx";

export const Route = createFileRoute("/settings/alerts")({
	component: Alerts,
});

const ALERTS = [
	"EVERY TRADE",
	"A MACHINE HITS ITS FLOOR",
	"A MACHINE PAUSES ITSELF",
	"FEE SOL RUNNING LOW",
	"A DAILY SUMMARY",
] as const;

/** What you are told about, and where: Telegram first, Maschina's own app later (A3 #178). */
function Alerts() {
	const [on, setOn] = useState<Record<string, boolean>>({
		"EVERY TRADE": true,
		"A MACHINE HITS ITS FLOOR": true,
	});
	return (
		<Page code="SETTINGS // ALERTS" title="TELL ME WHEN">
			<Part title="WHAT">
				<div className="flex max-w-[640px] flex-col gap-1.5">
					{ALERTS.map((alert) => (
						<Toggle
							key={alert}
							label={alert}
							on={on[alert] === true}
							onChange={(value) => setOn((was) => ({ ...was, [alert]: value }))}
						/>
					))}
				</div>
			</Part>
			<Part title="WHERE">
				<Coming>
					TELEGRAM, LINKED ONCE FROM HERE, THEN MASCHINA'S OWN APP. SAVED WITH THE BACKEND PASS.
				</Coming>
			</Part>
		</Page>
	);
}
