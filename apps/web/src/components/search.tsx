import { MagnifyingGlass } from "@phosphor-icons/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setIdleMode } from "../lib/idle.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { useTheme } from "../lib/theme.ts";
import { SECTIONS } from "./sections.tsx";

/**
 * Search: ⌘K (or Ctrl K) from anywhere, or the Search charm. One opaque bar near the top, the dashboard
 * dimmed behind it. Type to narrow, the arrow keys to move, Enter to go, Escape to close.
 *
 * It finds the pages, your machines by name, and the things you do anywhere.
 */

export type Result = {
	id: string;
	group: "Pages" | "Machines" | "Actions";
	label: string;
	detail?: string;
	run: () => void;
};

/** A result matches when every word typed appears in its label or detail, in any order. */
export function matches(result: Pick<Result, "label" | "detail">, typed: string): boolean {
	const haystack = `${result.label} ${result.detail ?? ""}`.toLowerCase();
	return typed
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => haystack.includes(word));
}

let shown = false;
const listeners = new Set<() => void>();
function setShown(next: boolean) {
	shown = next;
	for (const listener of listeners) listener();
}

/** Opens search from anywhere, such as a charm. */
export function openSearch() {
	setShown(true);
}

export function Search() {
	const open = useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => shown,
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setShown(!shown);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return open ? <SearchBox onClose={() => setShown(false)} /> : null;
}

function SearchBox({ onClose }: { onClose: () => void }) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const navigate = useNavigate();
	const [typed, setTyped] = useState("");
	const [at, setAt] = useState(0);
	const box = useRef<HTMLInputElement>(null);
	useEffect(() => box.current?.focus(), []);

	const go = (to: string) => () => void navigate({ to });
	const light = useTheme().mode === "light";
	const results: Result[] = [
		...SECTIONS.map((section) => ({
			id: `page:${section.to}`,
			group: "Pages" as const,
			label: section.label,
			run: go(section.to),
		})),
		...(session.data ? (machines.data ?? []) : []).map((machine) => ({
			id: `machine:${machine.machineId}`,
			group: "Machines" as const,
			label: machine.name,
			detail: machine.state,
			run: go(`/machines/${machine.machineId}`),
		})),
		{ id: "new", group: "Actions", label: "New machine", run: go("/new") },
		{ id: "settings", group: "Actions", label: "Settings", run: go("/settings") },
		{ id: "papers", group: "Pages", label: "Papers", run: go("/papers") },
		{ id: "alerts", group: "Actions", label: "Alerts", run: go("/settings/alerts") },
		{
			id: "idle",
			group: "Actions",
			label: "Idle mode",
			detail: "glide through the pages on its own",
			run: () => setIdleMode(true),
		},
		{
			id: "mode",
			group: "Actions",
			label: light ? "Dark mode" : "Light mode",
			run: () => {
				window.location.search = light ? "" : "?mode=light";
			},
		},
	];
	const found = results.filter((result) => matches(result, typed));

	const run = (result: Result | undefined) => {
		if (!result) return;
		onClose();
		result.run();
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			className="fixed inset-0 z-[60] flex justify-center bg-black/50 px-4 pt-[14vh]"
		>
			<button
				type="button"
				aria-label="Close search"
				tabIndex={-1}
				onClick={onClose}
				className="absolute inset-0 cursor-default"
			/>
			<div className="relative flex h-fit max-h-[62vh] w-full max-w-[600px] flex-col bg-(--surface-sheet)">
				<label className="flex items-center gap-3 px-5">
					<MagnifyingGlass size={20} weight="light" className="shrink-0 text-neutral-400" />
					<input
						ref={box}
						value={typed}
						onChange={(event) => {
							setTyped(event.target.value);
							setAt(0);
						}}
						onKeyDown={(event) => {
							if (event.key === "Escape") onClose();
							if (event.key === "ArrowDown") {
								event.preventDefault();
								setAt((was) => Math.min(found.length - 1, was + 1));
							}
							if (event.key === "ArrowUp") {
								event.preventDefault();
								setAt((was) => Math.max(0, was - 1));
							}
							if (event.key === "Enter") run(found[at]);
						}}
						placeholder="Search pages, machines and actions"
						aria-label="Search"
						className="h-14 min-w-0 flex-1 bg-transparent font-display text-[17px] text-neutral-100 outline-none placeholder:text-neutral-600"
					/>
				</label>
				<ul className="no-scrollbar overflow-y-auto pb-2">
					{found.length === 0 ? (
						<li className="px-5 py-4 text-[15px] text-neutral-500">Nothing matches.</li>
					) : null}
					{found.map((result, index) => {
						const first = index === 0 || found[index - 1]?.group !== result.group;
						return (
							<li key={result.id}>
								{first ? (
									<span className="block px-5 pt-3 pb-1.5 text-[12px] text-neutral-500">
										{result.group}
									</span>
								) : null}
								<button
									type="button"
									onMouseEnter={() => setAt(index)}
									onClick={() => run(result)}
									className={`flex w-full items-baseline justify-between gap-4 px-5 py-2.5 text-left font-display text-[16px] transition-colors ${index === at ? "bg-white/[0.1] text-white" : "text-neutral-300"}`}
								>
									<span className="truncate">{result.label}</span>
									{result.detail ? (
										<span className="shrink-0 text-[13px] text-neutral-500">{result.detail}</span>
									) : null}
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
