/**
 * Stop everything. `01-PRINCIPLES` P13, which does not yield.
 *
 * "The human can always see, stop, take over." A stop that is only reachable
 * from a terminal is not reachable when it is needed, so it sits in the title
 * bar, visible from every view, at all times.
 *
 * It is deliberately alarming to look at. `ENVIRONMENT_PLAN` slice 4: hiding it
 * because it looks alarming is the mistake, since being alarming is the point.
 *
 * **A stop is not a pause.** Revoking the root takes every capability in the tree
 * with it, and nothing revoked comes back. Starting again mints a new root and
 * everything has to be granted again by someone who decides it should exist. The
 * confirmation says so, in those words, because a person about to do this should
 * know it is not undo.
 */

import { useState } from "react";

const ACTOR = "human:operator";

export function Stop() {
	const [asking, setAsking] = useState(false);
	const [reason, setReason] = useState("");
	const [sending, setSending] = useState(false);
	const [outcome, setOutcome] = useState<string | null>(null);

	const stop = async () => {
		const why = reason.trim();
		if (why === "" || sending) return;
		setSending(true);

		const bridge = window.maschina;
		if (bridge === undefined) {
			setOutcome("The bridge did not load. Nothing has stopped. Use: pnpm stop:test");
			setSending(false);
			return;
		}

		const result = await bridge.stop.everything({ reason: why, actor: ACTOR });
		setOutcome(
			result.ok
				? `Stopped. ${result.value.revoked.length} capabilities revoked. Nothing comes back.`
				: result.problem,
		);
		setSending(false);
		if (result.ok) setReason("");
	};

	if (!asking) {
		return (
			<button type="button" className="stop" onClick={() => setAsking(true)}>
				stop everything
			</button>
		);
	}

	return (
		<div className="stopping">
			<div className="stopping__box">
				<h2 className="stopping__title">Stop everything?</h2>
				<p className="stopping__text">
					This revokes the root capability, and every capability granted under it. Every worker
					loses its authority immediately, with no cooperation needed from any of them.
				</p>
				<p className="stopping__text stopping__text--warn">
					A stop is not a pause. Nothing revoked comes back. Starting again creates a new root,
					and everything has to be granted again by whoever decides it should exist.
				</p>

				<textarea
					className="answer__box"
					value={reason}
					placeholder="Why you are stopping. This is recorded."
					rows={2}
					disabled={sending}
					onChange={(e) => setReason(e.target.value)}
				/>

				{outcome !== null && <p className="stopping__outcome">{outcome}</p>}

				<div className="answer__foot">
					<button
						type="button"
						className="answer__refuse"
						onClick={() => {
							setAsking(false);
							setOutcome(null);
						}}
					>
						{outcome === null ? "cancel" : "close"}
					</button>
					<button
						type="button"
						className="stop stop--confirm"
						disabled={reason.trim() === "" || sending}
						onClick={() => void stop()}
					>
						{sending ? "stopping" : "stop everything"}
					</button>
				</div>
			</div>
		</div>
	);
}
