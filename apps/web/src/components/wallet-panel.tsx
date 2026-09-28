import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { amount, type MachineSummary } from "../lib/machines.ts";
import type { SignedInOwner } from "../lib/session.ts";

/**
 * The wallet, sliding in from the right: your address, what you hold, and funding a machine without
 * copying an address or working out a fee. Funding was the worst part of the first real run (2026-09-28),
 * so the machine's own settings fill the amounts in.
 *
 * A scaffold for now: live balances and the one approval Fund button arrive with the backend pass, and
 * the embedded Maschina wallet slots into this same panel later.
 */

/** What a machine needs in SOL to pay its own network fees, sent alongside its float. */
export const FEE_SOL = "0.011";

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";
const BUTTON =
	"h-9 w-full border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40";

export function WalletPanelView({
	owner,
	machines,
	onClose,
	onDisconnect,
}: {
	owner: SignedInOwner;
	machines: MachineSummary[];
	onClose: () => void;
	onDisconnect: () => void;
}) {
	const [chosen, setChosen] = useState<string>();
	const [copied, setCopied] = useState(false);
	const machine = machines.find((each) => each.machineId === chosen);
	return (
		<aside
			aria-label="Wallet"
			className="fixed top-11 right-0 bottom-6 z-40 flex w-[min(360px,100vw)] flex-col gap-8 overflow-y-auto overscroll-none bg-black/75 p-5 backdrop-saturate-0"
		>
			<header className="flex items-center justify-between">
				<h2 className="text-[11px] text-neutral-300 tracking-[0.14em]">WALLET</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="text-neutral-500 hover:text-neutral-100"
				>
					<X size={14} weight="light" />
				</button>
			</header>

			<section aria-label="Your wallet" className="flex flex-col gap-3">
				<span className={LABEL}>YOUR ADDRESS</span>
				<span className="break-all text-[11.5px] text-neutral-200">{owner.walletAddress}</span>
				<button
					type="button"
					onClick={() => {
						void navigator.clipboard?.writeText(owner.walletAddress);
						setCopied(true);
					}}
					className={BUTTON}
				>
					{copied ? "COPIED" : "COPY ADDRESS"}
				</button>
				<div className="flex gap-8 pt-2">
					<div className="flex flex-col gap-1">
						<span className={LABEL}>SOL</span>
						<span className="text-[15px] text-neutral-500">-</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className={LABEL}>USDC</span>
						<span className="text-[15px] text-neutral-500">-</span>
					</div>
				</div>
				<span className="text-[10px] text-neutral-600 tracking-[0.1em]">
					LIVE BALANCES ARRIVE WITH THE BACKEND PASS
				</span>
			</section>

			<section aria-label="Fund a machine" className="flex flex-col gap-3">
				<span className={LABEL}>FUND A MACHINE</span>
				{machines.length === 0 ? (
					<span className="text-[11px] text-neutral-500">NO MACHINES YET</span>
				) : (
					<ul className="flex flex-col">
						{machines.map((each) => (
							<li key={each.machineId}>
								<button
									type="button"
									onClick={() => setChosen(each.machineId)}
									aria-pressed={each.machineId === chosen}
									className={`w-full border-white/[0.06] border-b py-2 text-left text-[11.5px] ${
										each.machineId === chosen
											? "text-neutral-100"
											: "text-neutral-500 hover:text-neutral-300"
									}`}
								>
									{each.name.toUpperCase()}
								</button>
							</li>
						))}
					</ul>
				)}
				{machine ? (
					<div className="flex flex-col gap-2 pt-1 text-[11.5px]">
						<span className="text-neutral-200">SENDS {amount(machine.budget.granted)} USDC</span>
						<span className="text-neutral-200">AND {FEE_SOL} SOL FOR ITS FEES</span>
						<span className="break-all text-[10.5px] text-neutral-500">
							TO {machine.walletAddress}
						</span>
						<button type="button" disabled className={`${BUTTON} mt-2`}>
							FUND · ONE APPROVAL
						</button>
						<span className="text-[10px] text-neutral-600 tracking-[0.1em]">
							SIGNING FROM YOUR WALLET ARRIVES WITH THE BACKEND PASS
						</span>
					</div>
				) : null}
			</section>

			<button type="button" onClick={onDisconnect} className={`${BUTTON} mt-auto`}>
				DISCONNECT
			</button>
		</aside>
	);
}
