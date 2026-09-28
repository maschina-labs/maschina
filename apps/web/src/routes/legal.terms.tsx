import { createFileRoute } from "@tanstack/react-router";
import { Copy, Page } from "../components/page.tsx";

export const Route = createFileRoute("/legal/terms")({
	component: () => (
		<Page code="LEGAL" title="TERMS OF USE">
			<Copy>
				THE TERMS OF USE ARE BEING WRITTEN, WITH A LAWYER, BEFORE ANYONE ELSE PUTS MONEY IN.
			</Copy>
		</Page>
	),
});
