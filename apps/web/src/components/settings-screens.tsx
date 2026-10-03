import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { alertsFrom } from "../lib/alerts.ts";
import { describeEvent } from "../lib/describe.ts";
import { useClearManagerKey, useManagerKey, useSetManagerKey } from "../lib/manager-key.ts";
import { useSession } from "../lib/session.ts";
import { setTheme, THEMES, useTheme } from "../lib/theme.ts";
import { toast } from "../lib/toasts.ts";
import { Headline, Note, Onward, Panel, Rows } from "./kit.tsx";
import { useActivity } from "./portfolio.tsx";

/**
 * Settings and the screens under it: alerts and API keys. What works, works; what is not built yet says
 * so plainly, with no button standing in for it.
 */

export function SettingsScreen() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const { theme } = useTheme();
	const wallet = session.data?.walletAddress;
	return (
		<>
			<Panel size="wide" name="Wallet">
				{wallet ? (
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard?.writeText(wallet);
							toast("Wallet address copied");
						}}
						className="break-all text-left font-mono text-[13px] text-neutral-100 hover:text-white"
						title="Copy"
					>
						{wallet}
					</button>
				) : (
					<Headline>Not connected</Headline>
				)}
				<Note>Signing in with email as well, and more than one wallet, arrive with accounts.</Note>
			</Panel>
			<AiKeyPanel />
			<Panel size="large" name="More">
				<Onward to="/settings/alerts">Alerts</Onward>
				<Onward to="/settings/keys">API keys</Onward>
				<Onward to="/papers">Papers</Onward>
			</Panel>
			<Panel size="large" name="Fees and plan">
				<Rows
					rows={[
						["Paper machines", "Free, as many as you like"],
						["Live machines", "As many as you like"],
						["Each running live machine", "A small monthly fee"],
						["Each trade", "A small share, inside the swap"],
						["Never charged", "Signing up, paper, stopped machines"],
					]}
				/>
				<Note>
					The exact numbers are set when billing is built, and shown here before anyone pays.
				</Note>
			</Panel>
			<Panel size="wide" name="Theme">
				<div className="grid grid-cols-4 gap-1">
					{THEMES.map((each) => (
						<button
							key={each.id}
							type="button"
							aria-pressed={theme === each.id}
							onClick={() => setTheme(each.id)}
							className={`py-2 text-[14px] transition-colors ${theme === each.id ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
						>
							{each.name}
						</button>
					))}
				</div>
				<Note>Dynamic follows the time of day and the weather where you are.</Note>
			</Panel>
			<Panel size="wide" name="Your data">
				<Note>
					Each machine's record exports from its screen. Exporting everything at once, and deleting
					your account and personal data, arrive with accounts.
				</Note>
			</Panel>
		</>
	);
}

/** Which moments are worth telling you about, and everything that has been worth telling so far. */
const TOLD = [
	"A trade completes or fails",
	"A trade is refused by the rules",
	"A machine pauses or stops",
	"Money is withdrawn or swept to the vault",
];

export function AlertsScreen() {
	const alerts = alertsFrom(useActivity());
	return (
		<>
			<Panel size="big" name={`Alerts · ${alerts.length}`} scroll>
				{alerts.length === 0 ? (
					<Note>Nothing to tell you yet.</Note>
				) : (
					<ol className="flex flex-col">
						{alerts.map((alert) => {
							const said = describeEvent(alert);
							return (
								<li
									key={alert.id}
									className="grid grid-cols-[auto_1fr] gap-x-5 border-white/[0.06] border-b py-2.5"
								>
									<time
										className="text-[13px] text-neutral-500 tabular-nums"
										dateTime={alert.occurredAt}
									>
										{new Date(alert.occurredAt).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</time>
									<span className="truncate text-[15px] text-neutral-100">
										{alert.machineName} · {said.title.toLowerCase()}
									</span>
								</li>
							);
						})}
					</ol>
				)}
			</Panel>
			<Panel size="large" name="What you are told">
				<ul className="flex flex-col gap-1.5">
					{TOLD.map((each) => (
						<li key={each} className="bg-white/[0.06] px-3 py-2.5 text-[15px] text-neutral-100">
							{each}
						</li>
					))}
				</ul>
				<Note>
					Shown here and in the charms now. Sent to Telegram once you can link it from here.
				</Note>
			</Panel>
		</>
	);
}

export function KeysScreen() {
	return (
		<>
			<Panel size="big" name="Your keys">
				<Headline>None yet</Headline>
				<Note>
					API keys let your own code use Maschina. Each is shown once when made, never again, can
					only do what its scope allows, and can be revoked here.
				</Note>
			</Panel>
			<Panel size="large" name="Arriving">
				<Note>API keys arrive with the developer SDK.</Note>
			</Panel>
		</>
	);
}

/**
 * Your own Anthropic key, which the manager thinks with. Pasted once, checked with Anthropic, kept sealed,
 * and never shown again: only its last four characters are.
 */
function AiKeyPanel() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const status = useManagerKey(api, Boolean(session.data));
	const save = useSetManagerKey(api, queryClient);
	const clear = useClearManagerKey(api, queryClient);
	const [draft, setDraft] = useState("");
	const [replacing, setReplacing] = useState(false);

	if (!session.data)
		return (
			<Panel size="wide" name="AI key">
				<Note>Connect to give the manager your Anthropic key.</Note>
			</Panel>
		);

	const set = status.data?.set && !replacing;
	return (
		<Panel size="wide" name="AI key">
			{set ? (
				<>
					<Headline>Anthropic key ending {status.data?.hint}</Headline>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => setReplacing(true)}
							className="bg-white/[0.06] px-3 py-2 text-[14px] text-neutral-200 hover:bg-white/[0.12]"
						>
							Replace
						</button>
						<button
							type="button"
							disabled={clear.isPending}
							onClick={() => clear.mutate(undefined, { onSuccess: () => toast("AI key removed") })}
							className="bg-white/[0.06] px-3 py-2 text-[14px] text-neutral-200 hover:bg-white/[0.12] disabled:opacity-40"
						>
							Remove
						</button>
					</div>
					<Note>The manager thinks with this key. It is kept sealed and never shown again.</Note>
				</>
			) : (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate(draft, {
							onSuccess: () => {
								setDraft("");
								setReplacing(false);
								toast("AI key saved");
							},
						});
					}}
					className="flex flex-col gap-2"
				>
					<div className="flex gap-1">
						<input
							type="password"
							autoComplete="off"
							spellCheck={false}
							aria-label="Anthropic key"
							placeholder="sk-ant-..."
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							className="min-w-0 flex-1 bg-white/[0.06] px-3 py-2 font-mono text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:bg-white/[0.1]"
						/>
						<button
							type="submit"
							disabled={!draft.trim() || save.isPending}
							className="bg-white px-4 py-2 text-[14px] text-neutral-950 disabled:opacity-30"
						>
							{save.isPending ? "Checking" : "Save"}
						</button>
					</div>
					{save.error ? (
						<p role="alert" className="text-[14px] text-neutral-100">
							{save.error.message}
						</p>
					) : null}
					<Note>
						From console.anthropic.com. It is checked with Anthropic, kept sealed, and never shown
						again. Set a spend limit there so the manager can never cost more than you chose.
					</Note>
				</form>
			)}
		</Panel>
	);
}
