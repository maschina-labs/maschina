import { createPortal } from "react-dom";
import { amount, type MachineDetail } from "../lib/machines.ts";
import { toast } from "../lib/toasts.ts";
import { winRate } from "./marketplace.tsx";

/**
 * A machine's result as a card to share: what it is, what it made, how often it won, and its band, in the
 * instrument style. Copying it as text works now; posting it into global chat arrives with chat's backend.
 */

/** The card as plain text, for pasting anywhere. */
export function resultText(machine: MachineDetail, band: string | undefined): string {
	return [
		`${machine.name.toUpperCase()} // ${machine.kind.toUpperCase()}${machine.result.simulated ? " // PAPER" : ""}`,
		`REALISED ${amount(machine.result.realised)} USDC · ${machine.result.trades} TRADES · WON ${winRate(machine)}`,
		...(band ? [`BAND ${band}`] : []),
		"RUN BY A MACHINE ON MASCHINA",
	].join("\n");
}

export function ResultCard({
	machine,
	band,
	onClose,
}: {
	machine: MachineDetail;
	band: string | undefined;
	onClose: () => void;
}) {
	const figures: [string, string][] = [
		["REALISED", amount(machine.result.realised)],
		["TRADES", String(machine.result.trades)],
		["WON", winRate(machine)],
	];
	return createPortal(
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Share this machine"
				className="flex w-full max-w-[420px] flex-col gap-5 bg-black/90 p-6 backdrop-saturate-0"
			>
				<div className="flex flex-col gap-4 border border-white/15 p-5">
					<span className="text-[9.5px] text-neutral-500 tracking-[0.16em]">
						{machine.kind.toUpperCase()} {"//"} {machine.result.simulated ? "PAPER" : "LIVE"}
					</span>
					<span className="text-[18px] text-neutral-100 tracking-[0.1em]">
						{machine.name.toUpperCase()}
					</span>
					<dl className="grid grid-cols-3 gap-3">
						{figures.map(([term, value]) => (
							<div key={term} className="flex flex-col gap-1">
								<dt className="text-[9.5px] text-neutral-500 tracking-[0.14em]">{term}</dt>
								<dd className="text-[20px] text-neutral-100 tabular-nums">{value}</dd>
							</div>
						))}
					</dl>
					{band ? (
						<span className="text-[10px] text-neutral-400 tabular-nums tracking-[0.12em]">
							BAND {band}
						</span>
					) : null}
					<span className="text-[9.5px] text-neutral-600 tracking-[0.16em]">
						RUN BY A MACHINE ON MASCHINA
					</span>
				</div>
				<div className="flex gap-1.5">
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard?.writeText(resultText(machine, band));
							toast("copied");
						}}
						className="h-10 flex-1 border border-white/40 text-[11px] text-neutral-100 tracking-[0.14em] hover:bg-white/[0.08]"
					>
						COPY AS TEXT
					</button>
					<button
						type="button"
						disabled
						className="h-10 flex-1 border border-white/15 text-[11px] text-neutral-400 tracking-[0.14em] disabled:opacity-40"
					>
						POST TO GLOBAL CHAT
					</button>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-[10.5px] text-neutral-500 tracking-[0.14em] hover:text-neutral-100"
				>
					CLOSE
				</button>
			</div>
		</div>,
		document.body,
	);
}
