/**
 * The tree and the editor. `ENVIRONMENT_PLAN` slice 9, governed by `ADR-011`.
 *
 * **Hosting, not replacing.** `ADR-011` §3: the working tree stays a real
 * directory. It opens in any other editor at the same time, its git history is
 * plain git, and deleting Maschina leaves the project exactly as it was. The
 * test for that is mechanical and it lives in the proof.
 *
 * **Why an editor exists here at all**, since `ADR-003` §2.1 asks whether a
 * surface exists to operate objectives or because IDEs have one: a decision that
 * needs a person is almost always a decision about code. Answering a suspended
 * worker means looking at what it did, and sending somebody to another
 * application to understand a question and back to answer it is the failure
 * `08-ENVIRONMENT` §1 describes.
 *
 * So this is deliberately small. It opens files, shows them, saves them. It is
 * not trying to be VS Code, and `ADR-011` §8 says what happens if it starts
 * trying: it gets deleted rather than improved.
 */

import { useCallback, useEffect, useState } from "react";
import type { Entry } from "../preload/index.ts";

export function Files() {
	const [root, setRoot] = useState<string | null>(null);
	const [tree, setTree] = useState<Record<string, Entry[]>>({});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [path, setPath] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [saved, setSaved] = useState("");
	const [problem, setProblem] = useState<string | null>(null);

	const load = useCallback(async (within: string) => {
		const result = await window.maschina?.workspace.list(within);
		if (result?.ok && result.value) {
			setTree((was) => ({ ...was, [within]: result.value ?? [] }));
		} else if (result) {
			setProblem(result.problem ?? "That could not be read.");
		}
	}, []);

	useEffect(() => {
		void (async () => {
			const already = await window.maschina?.workspace.opened();
			if (already != null) {
				setRoot(already);
				await load("");
			}
		})();
	}, [load]);

	const openProject = async () => {
		const result = await window.maschina?.workspace.open();
		if (result?.ok && result.value) {
			setRoot(result.value.root);
			setTree({});
			setExpanded(new Set());
			setPath(null);
			setProblem(null);
			await load("");
		}
	};

	const toggle = async (entry: Entry) => {
		if (entry.directory) {
			setExpanded((was) => {
				const next = new Set(was);
				if (next.has(entry.path)) next.delete(entry.path);
				else next.add(entry.path);
				return next;
			});
			if (tree[entry.path] === undefined) await load(entry.path);
			return;
		}
		const result = await window.maschina?.workspace.read(entry.path);
		if (result?.ok && result.value) {
			setPath(result.value.path);
			setText(result.value.text);
			setSaved(result.value.text);
			setProblem(null);
		} else if (result) {
			setProblem(result.problem ?? "That file could not be read.");
		}
	};

	const save = async () => {
		if (path === null) return;
		const result = await window.maschina?.workspace.write({ path, text });
		if (result?.ok) setSaved(text);
		else setProblem(result?.problem ?? "That file could not be saved.");
	};

	if (root === null) {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">No project open</h1>
				<p className="empty__text">
					Open a directory you already work in. Maschina reads and writes it in place, and
					anything else you use on it keeps working at the same time.
				</p>
				<button type="button" className="answer__send" onClick={() => void openProject()}>
					open a project
				</button>
			</div>
		);
	}

	const dirty = text !== saved;

	return (
		<div className="files">
			<div className="tree">
				<header className="tree__head">
					<span className="tree__root">{root.split("/").pop()}</span>
					<button type="button" className="answer__refuse" onClick={() => void openProject()}>
						open
					</button>
				</header>
				<Branch
					entries={tree[""] ?? []}
					tree={tree}
					expanded={expanded}
					open={path}
					depth={0}
					onPick={(e) => void toggle(e)}
				/>
			</div>

			<div className="editor">
				{problem !== null && <p className="answer__refused">{problem}</p>}
				{path === null ? (
					<div className="empty empty--centred">
						<p className="empty__text">Pick a file.</p>
					</div>
				) : (
					<>
						<header className="editor__head">
							<span className="editor__path">{path}</span>
							{dirty && <span className="dim">unsaved</span>}
							<button
								type="button"
								className="answer__send"
								disabled={!dirty}
								onClick={() => void save()}
							>
								save
							</button>
						</header>
						<textarea
							className="editor__text"
							value={text}
							spellCheck={false}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "s") {
									e.preventDefault();
									void save();
								}
							}}
						/>
					</>
				)}
			</div>
		</div>
	);
}

function Branch({
	entries,
	tree,
	expanded,
	open,
	depth,
	onPick,
}: {
	readonly entries: readonly Entry[];
	readonly tree: Record<string, Entry[]>;
	readonly expanded: ReadonlySet<string>;
	readonly open: string | null;
	readonly depth: number;
	readonly onPick: (entry: Entry) => void;
}) {
	return (
		<ul className="tree__list">
			{entries.map((entry) => (
				<li key={entry.path}>
					<button
						type="button"
						className={open === entry.path ? "tree__entry tree__entry--open" : "tree__entry"}
						style={{ paddingLeft: `${8 + depth * 12}px` }}
						onClick={() => onPick(entry)}
					>
						<span className="dim">
							{entry.directory ? (expanded.has(entry.path) ? "v" : ">") : " "}
						</span>
						{entry.name}
					</button>
					{entry.directory && expanded.has(entry.path) && (
						<Branch
							entries={tree[entry.path] ?? []}
							tree={tree}
							expanded={expanded}
							open={open}
							depth={depth + 1}
							onPick={onPick}
						/>
					)}
				</li>
			))}
		</ul>
	);
}
