/**
 * What has been granted, and taking it back.
 *
 * `08-ENVIRONMENT` §6 asks the environment to answer "what would break if I
 * revoked this capability". That question is only answerable next to the answer
 * to "what is granted at all", and neither was reachable from the window: the
 * whole authority model, which is the product, was visible only from a terminal.
 *
 * **Revoked and expired are shown, not filtered.** `05-CAPABILITIES` §10: a
 * denial is as much a fact as a use. A list that quietly drops what was taken
 * away cannot answer why something was refused ten minutes ago.
 *
 * **Revoking asks for a reason and does not ask twice.** `01-PRINCIPLES` P3 does
 * not yield, so nothing here may make revocation feel dangerous or add a step
 * that could fail. What it may do is say what the cost is first, which is the
 * difference between describing a consequence and discouraging an action.
 */

import { useCallback, useEffect, useState } from "react";
import type { WireCapability } from "../preload/index.ts";

/** Who is doing this. The log records a person, never "the window". */
const ME = "human:ash";

export function Authority({ onProblem }: { readonly onProblem: (p: string | null) => void }) {
	const [held, setHeld] = useState<readonly WireCapability[] | null>(null);
	const [open, setOpen] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [refused, setRefused] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const result = await window.maschina?.authority.list();
		if (result === undefined) return;
		if (result.ok) {
			setHeld(result.value);
			onProblem(null);
		} else {
			setHeld(null);
			onProblem(result.problem);
		}
	}, [onProblem]);

	useEffect(() => {
		void refresh();
		return window.maschina?.log.onRecorded(() => void refresh());
	}, [refresh]);

	const revoke = async (id: string) => {
		if (busy) return;
		setBusy(true);
		setRefused(null);
		const result = await window.maschina?.authority.revoke({
			id,
			actor: ME,
			// A revocation with no reason is a fact with half its meaning missing.
			reason: reason.trim() === "" ? "Revoked from the window." : reason.trim(),
		});
		setBusy(false);
		if (result !== undefined && !result.ok) {
			setRefused(result.problem);
			return;
		}
		setOpen(null);
		setReason("");
		await refresh();
	};

	if (held === null) {
		return (
			<div className="empty empty--centred">
				<p className="empty__text">Reading what has been granted.</p>
			</div>
		);
	}

	if (held.length === 0) {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">Nothing is granted</h1>
				<p className="empty__text">
					No worker holds any authority, so nothing can reach anything. That is the correct
					state for a system with no work in it, not an empty screen.
				</p>
			</div>
		);
	}

	const active = held.filter((c) => c.status === "active");
	const gone = held.filter((c) => c.status !== "active");

	return (
		<div className="authority">
			{refused !== null && <p className="answer__refused">{refused}</p>}

			<Group
				title="Held"
				capabilities={active}
				held={held}
				open={open}
				reason={reason}
				busy={busy}
				onOpen={(id) => {
					setOpen(open === id ? null : id);
					setReason("");
					setRefused(null);
				}}
				onReason={setReason}
				onRevoke={(id) => void revoke(id)}
			/>
			<Group
				title="No longer held"
				capabilities={gone}
				held={held}
				open={null}
				reason=""
				busy={busy}
				onOpen={() => undefined}
				onReason={() => undefined}
				onRevoke={() => undefined}
			/>
		</div>
	);
}

function Group({
	title,
	capabilities,
	held,
	open,
	reason,
	busy,
	onOpen,
	onReason,
	onRevoke,
}: {
	readonly title: string;
	readonly capabilities: readonly WireCapability[];
	readonly held: readonly WireCapability[];
	readonly open: string | null;
	readonly reason: string;
	readonly busy: boolean;
	readonly onOpen: (id: string) => void;
	readonly onReason: (r: string) => void;
	readonly onRevoke: (id: string) => void;
}) {
	if (capabilities.length === 0) return null;
	return (
		<>
			<h3 className="detail__heading">
				{title}
				<span className="detail__count">{capabilities.length}</span>
			</h3>
			<ul className="grants">
				{capabilities.map((capability) => (
					<Grant
						key={capability.id}
						capability={capability}
						held={held}
						open={open === capability.id}
						reason={reason}
						busy={busy}
						onOpen={() => onOpen(capability.id)}
						onReason={onReason}
						onRevoke={() => onRevoke(capability.id)}
					/>
				))}
			</ul>
		</>
	);
}

function Grant({
	capability,
	held,
	open,
	reason,
	busy,
	onOpen,
	onReason,
	onRevoke,
}: {
	readonly capability: WireCapability;
	readonly held: readonly WireCapability[];
	readonly open: boolean;
	readonly reason: string;
	readonly busy: boolean;
	readonly onOpen: () => void;
	readonly onReason: (r: string) => void;
	readonly onRevoke: () => void;
}) {
	const { limits } = capability;
	const available = limits.granted - limits.reserved - limits.settled;
	const alive = capability.status === "active";

	return (
		<li className={alive ? "grant" : "grant grant--gone"}>
			<div className="grant__head">
				<span className="grant__holder">{capability.holder}</span>
				<span className="grant__resource">{capability.resource}</span>
				<span className="grant__ops">{capability.operations.join(", ")}</span>
				<span className="grant__scope">{capability.scope}</span>
				{!alive && (
					<span className={`state state--${capability.status}`}>{capability.status}</span>
				)}
				{alive && (
					<button type="button" className="answer__refuse" onClick={onOpen}>
						revoke
					</button>
				)}
			</div>

			<dl className="facts">
				<dt>approval</dt>
				<dd>{capability.approval}</dd>
				<dt>effect class</dt>
				<dd>{capability.effectClass}</dd>
				<dt>on a crash</dt>
				<dd>{capability.checkpoint}</dd>
				<dt>can delegate</dt>
				<dd>
					{capability.delegationDepth === 0 ? "no" : `${capability.delegationDepth} deep`}
				</dd>
				{limits.granted > 0 && (
					<>
						<dt>budget</dt>
						{/* Three numbers, never one running balance. `05-CAPABILITIES` section 3. */}
						<dd>
							{available} left of {limits.granted}
							{limits.reserved > 0 && `, ${limits.reserved} held against work in flight`}
						</dd>
					</>
				)}
				<dt>expires</dt>
				<dd>{capability.expiresAt ?? "never"}</dd>
			</dl>

			{open && (
				<Cost
					capability={capability}
					held={held}
					reason={reason}
					busy={busy}
					onReason={onReason}
					onRevoke={onRevoke}
				/>
			)}
		</li>
	);
}

/**
 * What revoking this would take with it.
 *
 * Delegation attenuates, so anything granted from this one dies with it
 * (`04-WORKERS` §5). Saying so is describing the cost. It is never a reason not
 * to, and there is deliberately no confirmation step in front of the button.
 */
function Cost({
	capability,
	held,
	reason,
	busy,
	onReason,
	onRevoke,
}: {
	readonly capability: WireCapability;
	readonly held: readonly WireCapability[];
	readonly reason: string;
	readonly busy: boolean;
	readonly onReason: (r: string) => void;
	readonly onRevoke: () => void;
}) {
	const descendants = below(capability.id, held);
	return (
		<div className="grant__revoke">
			<p className="notice__text">
				{descendants.length === 0
					? "Nothing was granted from this one, so only the holder loses it."
					: `${descendants.length} capability${descendants.length === 1 ? "" : "s"} granted from this one goes with it: ${descendants.map((d) => d.holder).join(", ")}.`}
			</p>
			<p className="notice__text notice__text--dim">
				It stops at once and the holder is not asked. Anything in flight under it fails its next
				check rather than finishing.
			</p>
			<div className="field__row">
				<input
					className="field__input"
					placeholder="why"
					value={reason}
					disabled={busy}
					onChange={(e) => onReason(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") onRevoke();
					}}
				/>
				<button type="button" className="stop" disabled={busy} onClick={onRevoke}>
					{busy ? "revoking" : "revoke it"}
				</button>
			</div>
		</div>
	);
}

/** Everything attenuated from this capability, however deep. */
function below(id: string, all: readonly WireCapability[]): readonly WireCapability[] {
	const found: WireCapability[] = [];
	const frontier = [id];
	while (frontier.length > 0) {
		const parent = frontier.pop();
		for (const capability of all) {
			if (capability.parent === parent && !found.includes(capability)) {
				found.push(capability);
				frontier.push(capability.id);
			}
		}
	}
	return found;
}
