import { createFileRoute } from "@tanstack/react-router";
import { Copy, Page } from "../components/page.tsx";

export const Route = createFileRoute("/legal/privacy")({
	component: () => (
		<Page code="LEGAL" title="PRIVACY">
			<Copy>
				THE PRIVACY POLICY IS BEING WRITTEN, WITH A LAWYER, BEFORE ANYONE ELSE PUTS MONEY IN. IN
				SHORT: NO TRACKING, NO SELLING, AND YOUR DATA CAN BE EXPORTED OR DELETED FROM SETTINGS.
			</Copy>
		</Page>
	),
});
