import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/swap")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500">SWAP</h1>
			<p className="text-[12px] text-neutral-500">
				COMING: SWAP SOL AND USDC FROM YOUR OWN WALLET, ROUTED THROUGH JUPITER
			</p>
		</div>
	);
}
