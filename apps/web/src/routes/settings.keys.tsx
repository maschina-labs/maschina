import { createFileRoute } from "@tanstack/react-router";
import { Coming, Copy, Later, Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/settings/keys")({
	component: Keys,
});

/** API keys for the SDK (stage B): made here, shown once, revoked here. */
function Keys() {
	return (
		<Page code="SETTINGS // KEYS" title="API KEYS">
			<Part title="YOUR KEYS">
				<Copy>NONE YET.</Copy>
			</Part>
			<Part title="A NEW KEY">
				<Copy>
					SHOWN ONCE WHEN MADE, NEVER AGAIN. EACH KEY CAN ONLY DO WHAT ITS SCOPE ALLOWS, AND CAN BE
					REVOKED HERE.
				</Copy>
				<Later>MAKE A KEY</Later>
			</Part>
			<Coming>API KEYS ARRIVE WITH THE SDK (STAGE B).</Coming>
		</Page>
	);
}
