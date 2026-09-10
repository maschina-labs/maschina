/**
 * What needs a person. `ENVIRONMENT_PLAN` slice 3.
 *
 * `08-ENVIRONMENT` §1: the primary surface is a queue of things requiring human
 * authority, not a view of things happening. Most of what Maschina does needs no
 * attention, because it is proceeding correctly under granted authority. What
 * needs attention is the residue.
 *
 * **So an empty queue is the normal state, and it is the good one.**
 *
 * A stalled worker does not appear here as a red dot in a list. It appears as the
 * question it is asking, with a box underneath it, because that is the whole rule
 * this surface is built on: everything shown is actionable where it is shown.
 * Sending somebody elsewhere to answer is the failure `ADR-011` §4 describes.
 */

import { useCallback, useEffect, useState } from "react";
import type { WireSuspension } from "../preload/index.ts";
import { useReading } from "./useLog.ts";

/**
 * Who is answering.
 *
 * There are no accounts, so this is a claim rather than an authenticated
 * identity, and it is recorded as one. Getting the shape right now means the
 * history is not anonymous when accounts arrive.
 */
const ANSWERED_BY = "human:operator";

export function Queue({ onProblem }: { readonly onProblem: (p: string | null) => void }) {
	const read = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.queue.list();
	}, []);

	const { value, connection, refresh } = useReading(read);
	const waiting = value ?? [];

	const problem = connection.state === "lost" ? connection.problem : null;
	useEffect(() => onProblem(problem), [onProblem, problem]);

	// A clock resolves an `until`; only a person resolves a `question`. Keeping
	// them apart is the distinction the whole surface turns on.
	const forAPerson = waiting.filter((w) => w.kind === "question");
	const forAClock = waiting.filter((w) => w.kind !== "question");

	if (waiting.length === 0 && connection.state === "connected") {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">Nothing needs you</h1>
				<p className="empty__text">
					Everything running is proceeding under authority it was already granted. This is the
					normal state, not an empty one.
				</p>
			</div>
		);
	}

	return (
		<div className="queue">
			{forAPerson.map((suspension) => (
				<Question key={suspension.worker} suspension={suspension} onAnswered={refresh} />
			))}
			{forAClock.length > 0 && (
				<section className="waiting">
					<h3 className="detail__heading">Waiting on a clock, not on you</h3>
					{forAClock.map((w) => (
						<p key={w.worker} className="waiting__line">
							<span className="waiting__worker">{w.worker}</span> {w.reason}
							{w.resumeAt !== null && <span className="dim"> until {when(w.resumeAt)}</span>}
						</p>
					))}
				</section>
			)}
		</div>
	);
}

function Question({
	suspension,
	onAnswered,
}: {
	readonly suspension: WireSuspension;
	readonly onAnswered: () => void;
}) {
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [refused, setRefused] = useState<string | null>(null);

	const send = async () => {
		const because = text.trim();
		if (because === "" || sending) return;
		setSending(true);
		setRefused(null);

		const bridge = window.maschina;
		if (bridge === undefined) {
			setRefused("The bridge did not load, so nothing can be sent.");
			setSending(false);
			return;
		}

		const result = await bridge.queue.answer({
			worker: suspension.worker,
			objective: suspension.objective,
			because,
			answeredBy: ANSWERED_BY,
		});

		if (result.ok) {
			setText("");
			onAnswered();
		} else {
			// An answer that did not arrive must never look like one that did. The
			// worker is still stopped and the text stays in the box.
			setRefused(result.problem);
		}
		setSending(false);
	};

	return (
		<article className="question">
			<header className="question__head">
				<span className="question__worker">{suspension.worker}</span>
				<span className="dim">stopped {ago(suspension.since)}</span>
			</header>

			<p className="question__text">{suspension.question}</p>

			<p className="question__why">
				<span className="dim">why it stopped</span> {suspension.reason}
			</p>

			<div className="answer">
				<textarea
					className="answer__box"
					value={text}
					placeholder="Answer it. This is recorded, and the worker carries on."
					rows={3}
					disabled={sending}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						// Enter sends, shift+enter is a newline. An answer is usually one
						// sentence and reaching for the mouse to send it is friction.
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							void send();
						}
					}}
				/>
				<div className="answer__foot">
					{refused !== null ? (
						<span className="answer__refused">{refused}</span>
					) : (
						<span className="dim">recorded as {ANSWERED_BY}</span>
					)}
					<button
						type="button"
						className="answer__send"
						disabled={text.trim() === "" || sending}
						onClick={() => void send()}
					>
						{sending ? "sending" : "answer and resume"}
					</button>
				</div>
			</div>
		</article>
	);
}

function when(iso: string): string {
	const at = new Date(iso);
	return Number.isNaN(at.getTime()) ? iso : at.toLocaleString();
}

/** How long it has been stopped. Rounded, because precision here is noise. */
function ago(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return iso;
	const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
	if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
	return `${Math.round(seconds / 86_400)}d ago`;
}
