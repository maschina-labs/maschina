/**
 * A terminal panel, running the operator's own shell.
 *
 * `ADR-003` §3.1: "A terminal panel running the operator's own zsh is a terminal
 * emulator and is entirely fine. It is not where workers execute."
 *
 * So this is exactly what it looks like: their login shell, their profile, their
 * aliases, their prompt. Unbounded, because it is their machine, and a terminal
 * that refused to run their own commands would be a worse terminal rather than a
 * safer one.
 *
 * A worker's shell is a different thing entirely and cannot be reached from
 * here, which is enforced by the two being separate modules rather than by
 * anything on this side being careful.
 */

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

/** One shell per window. Tabs can come later, when one is not enough. */
const ID = "main";

export function Terminal({ cwd }: { readonly cwd: string | null }) {
	const host = useRef<HTMLDivElement>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [ended, setEnded] = useState<number | null>(null);

	useEffect(() => {
		const bridge = window.maschina;
		const element = host.current;
		if (bridge === undefined || element === null) return;

		const xterm = new Xterm({
			fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
			fontSize: 12,
			cursorBlink: true,
			// Matches the window rather than xterm's default, so the panel does not
			// look like a different application sitting inside this one.
			theme: {
				background: "#0c0d10",
				foreground: "#e6e8ee",
				cursor: "#6f8cff",
				selectionBackground: "#22252d",
			},
		});
		const fit = new FitAddon();
		xterm.loadAddon(fit);
		xterm.open(element);
		fit.fit();

		const stopData = bridge.terminal.onData(ID, (chunk) => xterm.write(chunk));
		const stopExit = bridge.terminal.onExit(ID, (code) => setEnded(code));
		const stopProblem = bridge.terminal.onProblem(ID, (why) => setProblem(why));

		bridge.terminal.start({ id: ID, cwd });
		bridge.terminal.resize({ id: ID, cols: xterm.cols, rows: xterm.rows });

		xterm.onData((data) => bridge.terminal.write({ id: ID, data }));

		// Anything that draws its own interface, an editor or a pager, needs the
		// real size or it draws at the wrong width and looks broken.
		const resized = new ResizeObserver(() => {
			fit.fit();
			bridge.terminal.resize({ id: ID, cols: xterm.cols, rows: xterm.rows });
		});
		resized.observe(element);

		xterm.focus();

		return () => {
			resized.disconnect();
			stopData();
			stopExit();
			stopProblem();
			xterm.dispose();
			// The shell keeps running. Switching tabs should not kill what somebody
			// left running, and the window closing stops everything anyway.
		};
	}, [cwd]);

	return (
		<div className="terminal">
			{problem !== null && (
				<p className="answer__refused">The shell would not start: {problem}</p>
			)}
			{ended !== null && (
				<p className="dim">
					The shell exited ({ended}). Switch away and back to start another.
				</p>
			)}
			<div ref={host} className="terminal__screen" />
		</div>
	);
}
