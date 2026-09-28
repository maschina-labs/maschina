import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
	component: () => (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">PRIVACY</h1>
			<p className="text-[12px] text-neutral-500">
				THE PRIVACY POLICY IS BEING WRITTEN, WITH A LAWYER, BEFORE ANYONE ELSE PUTS MONEY IN.
			</p>
		</div>
	),
});
