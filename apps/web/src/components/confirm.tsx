import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Asked before anything serious: what will happen, in plain words, and two buttons. Rendered at the top of
 * the page, over everything, so nothing traps it.
 */
export function Confirm({
	title,
	lines,
	confirm,
	onConfirm,
	onCancel,
}: {
	title: string;
	lines: string[];
	confirm: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const button = "h-10 flex-1 border text-[11px] tracking-[0.14em] transition-colors";
	const yes = useRef<HTMLButtonElement>(null);
	// Focus lands on the answer, and Escape is always a way out.
	useEffect(() => {
		yes.current?.focus();
		const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel]);
	return createPortal(
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
			<div
				role="alertdialog"
				aria-modal="true"
				aria-label={title}
				className="flex w-full max-w-[400px] flex-col gap-5 bg-black/90 p-6 backdrop-saturate-0"
			>
				<h2 className="text-[13px] text-neutral-100 tracking-[0.12em]">{title}</h2>
				<div className="flex flex-col gap-2">
					{lines.map((line) => (
						<p
							key={line}
							className="text-[11px] text-neutral-400 leading-relaxed tracking-[0.08em]"
						>
							{line}
						</p>
					))}
				</div>
				<div className="flex gap-1.5">
					<button
						type="button"
						onClick={onCancel}
						className={`${button} border-white/15 text-neutral-400 hover:text-neutral-100`}
					>
						CANCEL
					</button>
					<button
						type="button"
						ref={yes}
						onClick={onConfirm}
						className={`${button} border-white/40 text-neutral-100 hover:bg-white/[0.08]`}
					>
						{confirm}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
