/**
 * Where the control plane is.
 *
 * The packaged application is only the window. It has to be told where to read
 * from, and until it is told, saying so is the useful thing to do. This is the
 * saying so, and the place it gets answered.
 *
 * It is deliberately not a gate. The shell, the files and git are the operator's
 * own surfaces and need no control plane at all, so an unset address must not
 * black out the window: starting a control plane from Maschina's own terminal and
 * then connecting to it is a real way to use this.
 */

import { useCallback, useEffect, useState } from "react";
import type { Where } from "../preload/index.ts";

export function useWhere(): {
	readonly where: Where | null;
	readonly setWhere: (next: Where) => void;
} {
	const [where, setWhere] = useState<Where | null>(null);

	useEffect(() => {
		let live = true;
		void window.maschina?.plane.where().then((w) => {
			if (live) setWhere(w);
		});
		return () => {
			live = false;
		};
	}, []);

	return { where, setWhere };
}

/**
 * Ask for the address, or change it.
 *
 * The suggestion is filled in rather than assumed. Those are different: one is a
 * shortcut for the common case, the other is choosing on somebody's behalf and
 * then blaming them when it is wrong.
 */
export function Connect({
	where,
	onChanged,
	onDismiss,
}: {
	readonly where: Where;
	readonly onChanged: (next: Where) => void;
	readonly onDismiss?: (() => void) | undefined;
}) {
	const [text, setText] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (where.url !== null) {
			setText(where.url);
			return;
		}
		void window.maschina?.plane.suggested().then(setText);
	}, [where.url]);

	const save = useCallback(async () => {
		setBusy(true);
		setProblem(null);
		const outcome = await window.maschina?.plane.save(text);
		setBusy(false);
		if (outcome === undefined) {
			setProblem("The bridge to the main process is not there.");
			return;
		}
		if (!outcome.ok) {
			setProblem(outcome.problem);
			return;
		}
		onChanged(outcome.value);
		onDismiss?.();
	}, [text, onChanged, onDismiss]);

	const overridden = where.source === "override";

	return (
		<div className="notice">
			<strong className="notice__title">
				{where.url === null ? "No control plane yet" : "Control plane"}
			</strong>
			<p className="notice__text">
				{where.url === null
					? "Maschina reads the log from a control plane. Say where yours is. If you do not have one running, open the shell tab and start one, then come back."
					: "Change where this window reads from."}
			</p>
			{where.trouble !== undefined && <p className="notice__text">{where.trouble}</p>}

			<div className="field field--inline">
				<label className="field__label" htmlFor="plane-address">
					address
				</label>
				<div className="field__row">
					<input
						id="plane-address"
						className="field__input"
						value={text}
						spellCheck={false}
						autoComplete="off"
						disabled={busy || overridden}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void save();
						}}
					/>
					<button
						type="button"
						className="answer__send"
						disabled={busy || overridden || text.trim() === ""}
						onClick={() => void save()}
					>
						{busy ? "saving" : "connect"}
					</button>
					{onDismiss !== undefined && (
						<button type="button" className="answer__refuse" onClick={onDismiss}>
							cancel
						</button>
					)}
				</div>
			</div>

			{overridden && (
				<p className="notice__text notice__text--dim">
					MASCHINA_CONTROL_PLANE_URL is set, so it wins over anything saved here. That is what
					`pnpm dev` does.
				</p>
			)}
			{problem !== null && <p className="notice__text">{problem}</p>}
		</div>
	);
}
