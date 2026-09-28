import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "../lib/session.ts";
import { GLASS, GLASS_ACTIVE } from "./glass.ts";

/**
 * Settings: your wallet, what you are told about, what Maschina costs, and your own AI key later. Alerts
 * are laid out now and saved once the backend carries them; fees are stated plainly (D-091), with the
 * numbers set when billing is built.
 */

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section aria-label={title} className="flex flex-col gap-3">
			<h2 className={LABEL}>{title}</h2>
			{children}
		</section>
	);
}

/** A glass row that switches on and off. */
export function Toggle({
	label,
	on,
	onChange,
}: {
	label: string;
	on: boolean;
	onChange: (on: boolean) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => onChange(!on)}
			className={`flex h-11 items-center justify-between px-4 text-left text-[11.5px] tracking-[0.12em] transition-colors ${on ? GLASS_ACTIVE : GLASS}`}
		>
			<span className={on ? "text-neutral-100" : "text-neutral-400"}>{label}</span>
			<span className={on ? "text-neutral-100" : "text-neutral-600"}>{on ? "ON" : "OFF"}</span>
		</button>
	);
}

const ALERTS = [
	"EVERY TRADE",
	"A MACHINE HITS ITS FLOOR",
	"A MACHINE PAUSES ITSELF",
	"FEE SOL RUNNING LOW",
	"A DAILY SUMMARY",
] as const;

export function Settings() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const [alerts, setAlerts] = useState<Record<string, boolean>>({
		"EVERY TRADE": true,
		"A MACHINE HITS ITS FLOOR": true,
	});
	return (
		<div className="flex max-w-[640px] flex-col gap-10">
			<Section title="WALLET">
				<p className="break-all text-[12px] text-neutral-200">
					{session.data ? session.data.walletAddress : "NOT CONNECTED"}
				</p>
				<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
					MORE THAN ONE WALLET, AND A MASCHINA WALLET UNLOCKED WITH A PASSKEY, ARRIVE LATER.
				</p>
			</Section>

			<Section title="TELL ME WHEN">
				<div className="flex flex-col gap-1.5">
					{ALERTS.map((alert) => (
						<Toggle
							key={alert}
							label={alert}
							on={alerts[alert] === true}
							onChange={(on) => setAlerts((was) => ({ ...was, [alert]: on }))}
						/>
					))}
				</div>
				<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
					ALERTS GO TO TELEGRAM FIRST, AND MASCHINA'S OWN APP LATER. SAVED WITH THE BACKEND PASS.
				</p>
			</Section>

			<Section title="FEES AND PLAN">
				<dl className="flex flex-col">
					{(
						[
							["PAPER MACHINES", "FREE, AND AS MANY AS YOU LIKE"],
							["LIVE MACHINES", "AS MANY AS YOU LIKE"],
							["EACH RUNNING LIVE MACHINE", "A SMALL MONTHLY FEE"],
							["EACH TRADE", "A SMALL SHARE, TAKEN INSIDE THE SWAP"],
							["WHAT YOU NEVER PAY FOR", "SIGNING UP, PAPER, OR A MACHINE THAT IS STOPPED"],
						] as const
					).map(([term, meaning]) => (
						<div
							key={term}
							className="flex items-baseline justify-between gap-6 border-white/[0.06] border-b py-2.5 text-[11.5px] tracking-[0.1em]"
						>
							<dt className="text-neutral-500">{term}</dt>
							<dd className="text-right text-neutral-100">{meaning}</dd>
						</div>
					))}
				</dl>
				<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
					THE EXACT NUMBERS ARE SET WHEN BILLING IS BUILT, AND SHOWN HERE BEFORE ANYONE PAYS.
				</p>
			</Section>

			<Section title="YOUR AI KEY">
				<p className="text-[11px] text-neutral-500 tracking-[0.1em]">
					FOR THE AI MANAGER: BRING YOUR OWN KEY AND PAY LESS. ARRIVES WITH THE AI MANAGER.
				</p>
			</Section>
		</div>
	);
}
