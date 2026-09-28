import { useToasts } from "../lib/toasts.ts";

/** Where toasts appear: the bottom right, above the status bar, newest last. */
export function Toaster() {
	const toasts = useToasts();
	return (
		<div
			role="status"
			aria-live="polite"
			className="pointer-events-none fixed right-3 bottom-10 z-50 flex flex-col items-end gap-1.5"
		>
			{toasts.map((each) => (
				<p
					key={each.id}
					className={`bg-black/85 px-3.5 py-2 text-[10.5px] tracking-[0.14em] backdrop-saturate-0 ${
						each.tone === "problem"
							? "text-neutral-300 outline outline-white/30"
							: "text-neutral-100"
					}`}
				>
					{each.text}
				</p>
			))}
		</div>
	);
}
