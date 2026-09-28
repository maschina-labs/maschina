import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Command, commandsFor, matches } from "../lib/commands.ts";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

/**
 * ⌘K (or Ctrl K) anywhere: type to jump to any page or machine. Arrow keys move, Enter goes, Escape
 * closes. Rendered at the top of the page, over everything.
 */
export function CommandPaletteView({
	commands,
	onRun,
	onClose,
}: {
	commands: Command[];
	onRun: (command: Command) => void;
	onClose: () => void;
}) {
	const [typed, setTyped] = useState("");
	const [at, setAt] = useState(0);
	const box = useRef<HTMLInputElement>(null);
	const found = commands.filter((command) => matches(command, typed));
	useEffect(() => box.current?.focus(), []);
	const key = (event: React.KeyboardEvent) => {
		if (event.key === "Escape") onClose();
		if (event.key === "ArrowDown") setAt((was) => Math.min(found.length - 1, was + 1));
		if (event.key === "ArrowUp") setAt((was) => Math.max(0, was - 1));
		if (event.key === "Enter" && found[at]) onRun(found[at]);
	};
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			className="fixed inset-0 z-50 flex justify-center bg-black/50 p-4 pt-[14vh]"
		>
			<div className="flex h-fit max-h-[60vh] w-full max-w-[560px] flex-col bg-black/90 backdrop-saturate-0">
				<input
					ref={box}
					value={typed}
					onChange={(event) => {
						setTyped(event.target.value);
						setAt(0);
					}}
					onKeyDown={key}
					placeholder="GO TO A PAGE OR MACHINE"
					aria-label="Search commands"
					className="h-12 border-white/10 border-b bg-transparent px-4 text-[12px] text-neutral-100 uppercase tracking-[0.12em] outline-none placeholder:text-neutral-600"
				/>
				<ul className="overflow-y-auto py-1.5">
					{found.length === 0 ? (
						<li className="px-4 py-3 text-[11px] text-neutral-500">NOTHING MATCHES</li>
					) : null}
					{found.map((command, index) => (
						<li key={command.id}>
							<button
								type="button"
								onClick={() => onRun(command)}
								onMouseEnter={() => setAt(index)}
								aria-current={index === at}
								className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left text-[11.5px] tracking-[0.12em] ${index === at ? "bg-white/[0.07] text-neutral-100" : "text-neutral-400"}`}
							>
								<span className="truncate">{command.label}</span>
								<span className="shrink-0 text-[10px] text-neutral-600">{command.hint}</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

export function CommandPalette() {
	const { api } = useRouter().options.context;
	const navigate = useNavigate();
	const session = useSession(api);
	const machines = useMachines(api);
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((was) => !was);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	if (!open) return null;
	const commands = commandsFor(session.data ? (machines.data ?? []) : []);
	return createPortal(
		<CommandPaletteView
			commands={commands}
			onClose={() => setOpen(false)}
			onRun={(command) => {
				setOpen(false);
				if (command.to)
					void navigate({
						to: command.to,
						...(command.search ? { search: command.search } : {}),
					} as never);
			}}
		/>,
		document.body,
	);
}
