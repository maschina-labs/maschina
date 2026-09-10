/**
 * Git, in one place. `ENVIRONMENT_PLAN` slice 11.
 *
 * The operator's git on the directory they opened: what changed, what is staged,
 * the diff, a commit, a push.
 *
 * **This is not the repository capability.** A worker commits through a broker
 * so it never sees a credential, scoped to a branch pattern, recorded as Intent
 * and Outcome, revocable in one action. This is a person running git on their
 * own repository, and the two share no code for the same reason the terminal and
 * the filesystem do not.
 *
 * **Maschina does not replace git.** `08-ENVIRONMENT` §2 lists it as never
 * replaced and `ADR-011` did not reverse that row. The real binary runs against
 * the real repository, so what you do here is indistinguishable from what you
 * would do in a terminal, and everything else on that directory keeps working.
 */

import { useCallback, useEffect, useState } from "react";
import type { Change, Status } from "../preload/index.ts";

export function Git() {
	const [status, setStatus] = useState<Status | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const [said, setSaid] = useState<string | null>(null);
	const [showing, setShowing] = useState<string | null>(null);
	const [diff, setDiff] = useState("");

	const refresh = useCallback(async () => {
		const result = await window.maschina?.git.status();
		if (result?.ok && result.value) {
			setStatus(result.value);
			setProblem(null);
		} else if (result) {
			setStatus(null);
			setProblem(result.problem ?? "git could not be read.");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const show = async (path: string) => {
		if (showing === path) {
			setShowing(null);
			return;
		}
		const result = await window.maschina?.git.diff(path);
		setShowing(path);
		setDiff(result?.ok ? (result.value ?? "") : (result?.problem ?? ""));
	};

	const act = async (what: () => Promise<{ ok: boolean; problem?: string } | undefined>) => {
		if (busy) return;
		setBusy(true);
		setSaid(null);
		const result = await what();
		if (result && !result.ok) setProblem(result.problem ?? "That did not work.");
		else setProblem(null);
		await refresh();
		setBusy(false);
	};

	if (problem !== null && status === null) {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">No repository</h1>
				<p className="empty__text">{problem}</p>
			</div>
		);
	}
	if (status === null) return <div className="empty empty--centred">reading...</div>;

	const staged = status.changes.filter((c) => c.staged);
	const unstaged = status.changes.filter((c) => !c.staged);

	return (
		<div className="git">
			<header className="git__head">
				<span className="git__branch">{status.branch}</span>
				{status.upstream !== null ? (
					<span className="dim">
						{status.upstream}
						{status.ahead > 0 && ` ahead ${status.ahead}`}
						{status.behind > 0 && ` behind ${status.behind}`}
					</span>
				) : (
					<span className="dim">no upstream</span>
				)}
				<button type="button" className="answer__refuse" onClick={() => void refresh()}>
					refresh
				</button>
			</header>

			{problem !== null && <p className="answer__refused">{problem}</p>}
			{said !== null && <p className="cost__note">{said}</p>}

			<Group
				title="Staged"
				changes={staged}
				showing={showing}
				diff={diff}
				onShow={(p) => void show(p)}
				action="unstage"
				onAct={(p) =>
					void act(() => window.maschina?.git.unstage([p]) ?? Promise.resolve(undefined))
				}
			/>
			<Group
				title="Changed"
				changes={unstaged}
				showing={showing}
				diff={diff}
				onShow={(p) => void show(p)}
				action="stage"
				onAct={(p) =>
					void act(() => window.maschina?.git.stage([p]) ?? Promise.resolve(undefined))
				}
			/>

			{status.changes.length === 0 && (
				<p className="cost__note">Nothing to commit. The working tree is clean.</p>
			)}

			<h3 className="detail__heading">Commit</h3>
			<textarea
				className="answer__box"
				rows={2}
				value={message}
				placeholder="What changed, and why."
				disabled={busy}
				onChange={(e) => setMessage(e.target.value)}
			/>
			<div className="answer__foot">
				<span className="dim">
					{staged.length} staged
					{status.ahead > 0 && `, ${status.ahead} to push`}
				</span>
				<button
					type="button"
					className="answer__refuse"
					disabled={busy || status.ahead === 0}
					onClick={() =>
						void act(async () => {
							const result = await window.maschina?.git.push();
							if (result?.ok) setSaid(result.value ?? "Pushed.");
							return result;
						})
					}
				>
					push
				</button>
				<button
					type="button"
					className="answer__send"
					disabled={busy || staged.length === 0 || message.trim() === ""}
					onClick={() =>
						void act(async () => {
							const result = await window.maschina?.git.commit(message);
							if (result?.ok) {
								setMessage("");
								setSaid(result.value ?? "Committed.");
							}
							return result;
						})
					}
				>
					commit
				</button>
			</div>
			<p className="cost__note">
				This runs the real git binary on the real repository. There is no force-push here.
			</p>
		</div>
	);
}

function Group({
	title,
	changes,
	showing,
	diff,
	onShow,
	action,
	onAct,
}: {
	readonly title: string;
	readonly changes: readonly Change[];
	readonly showing: string | null;
	readonly diff: string;
	readonly onShow: (path: string) => void;
	readonly action: string;
	readonly onAct: (path: string) => void;
}) {
	if (changes.length === 0) return null;
	return (
		<>
			<h3 className="detail__heading">
				{title}
				<span className="detail__count">{changes.length}</span>
			</h3>
			<ul className="changes">
				{changes.map((change) => (
					<li key={change.path}>
						<div className="change">
							<span className="change__code">{change.code}</span>
							<button
								type="button"
								className="change__path"
								onClick={() => onShow(change.path)}
							>
								{change.path}
							</button>
							<button
								type="button"
								className="answer__refuse"
								onClick={() => onAct(change.path)}
							>
								{action}
							</button>
						</div>
						{showing === change.path && <pre className="diff">{colourless(diff)}</pre>}
					</li>
				))}
			</ul>
		</>
	);
}

/** Trim the diff header. A person opening one file already knows which file. */
function colourless(diff: string): string {
	const at = diff.indexOf("@@");
	return at === -1 ? diff : diff.slice(at);
}
