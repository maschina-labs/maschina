import { MagnifyingGlass } from "@phosphor-icons/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { setIdleMode } from "../lib/idle.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { setChoice, useTheme } from "../lib/theme.ts";
import { SECTIONS } from "./sections.tsx";

/**
 * Search, in the header: ⌘K (or Ctrl K) from anywhere, or Search in the tiles, opens the header with the
 * cursor in the field. The results drop below it, over the page. Type to narrow, the arrow keys to move,
 * Enter to go, Escape to close.
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

const FOCUS = "maschina:focus-search";

/** Puts the cursor in the header's search field, which is already showing or about to be. */
export function focusSearch() {
	window.dispatchEvent(new Event(FOCUS));
}

export function SearchField({ onClose }: { onClose: () => void }) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const navigate = useNavigate();
	const [typed, setTyped] = useState("");
	const [at, setAt] = useState(0);
	const box = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const focus = () => box.current?.focus();
		window.addEventListener(FOCUS, focus);
		return () => window.removeEventListener(FOCUS, focus);
	}, []);

	const go = (to: string) => () => void navigate({ to });
	const light = useTheme().mode === "light";
	const showing = typed.trim().length > 0;
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
			run: () => setChoice({ mode: light ? "dark" : "light" }),
		},
	];
	const found = results.filter((result) => matches(result, typed));

	const run = (result: Result | undefined) => {
		if (!result) return;
		setTyped("");
		onClose();
		result.run();
	};

	return (
		<search className="relative block w-[min(400px,52vw)]">
			<label className="flex h-12 items-center gap-3 bg-white/[0.08] px-4 transition-colors focus-within:bg-white/[0.12]">
				<MagnifyingGlass size={18} weight="light" className="shrink-0 text-neutral-400" />
				<input
					ref={box}
					value={typed}
					onChange={(event) => {
						setTyped(event.target.value);
						setAt(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							setTyped("");
							onClose();
						}
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
					className="min-w-0 flex-1 bg-transparent font-display text-[16px] text-neutral-100 outline-none placeholder:text-neutral-500"
				/>
				<kbd className="hidden shrink-0 text-[12px] text-neutral-500 md:inline">⌘K</kbd>
			</label>
			{showing ? (
				<ul
					aria-label="Results"
					className="no-scrollbar absolute inset-x-0 top-full z-10 max-h-[52vh] overflow-y-auto bg-(--surface-sheet) pb-2 shadow-[0_24px_48px_-12px_oklch(0_0_0/0.45)]"
				>
					{found.length === 0 ? (
						<li className="px-4 py-4 text-[15px] text-neutral-500">Nothing matches.</li>
					) : null}
					{found.map((result, index) => {
						const first = index === 0 || found[index - 1]?.group !== result.group;
						return (
							<li key={result.id}>
								{first ? (
									<span className="block px-4 pt-3 pb-1.5 text-[12px] text-neutral-500">
										{result.group}
									</span>
								) : null}
								<button
									type="button"
									onMouseEnter={() => setAt(index)}
									onClick={() => run(result)}
									className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left font-display text-[15px] transition-colors ${index === at ? "bg-white/[0.1] text-white" : "text-neutral-300"}`}
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
			) : null}
		</search>
	);
}
