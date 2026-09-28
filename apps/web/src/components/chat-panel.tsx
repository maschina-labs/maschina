import { X } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { answer, QUESTIONS, type Question } from "../lib/answers.ts";
import { type MachineSummary, useMachine, useMachines, useRecord } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

/**
 * Chat, sliding in from the right. Global is the community's room, scaffolded until the backend carries
 * messages. Machines is you asking one of your machines, and it answering from its own record (D-037);
 * the quick questions work now, and free typing arrives with the AI manager.
 */

type Line = { from: "you" | "machine"; text: string };
const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";
const CHIP =
	"border border-white/20 px-2.5 py-1.5 text-[10.5px] text-neutral-200 tracking-[0.12em] transition-colors hover:bg-white/[0.06]";

export function Conversation({ lines }: { lines: Line[] }) {
	return (
		<ol aria-label="Conversation" className="flex flex-col gap-4">
			{lines.map((line, index) => (
				// A conversation only grows at the end, so a line's place is its identity.
				// biome-ignore lint/suspicious/noArrayIndexKey: see above
				<li
					key={index}
					className={`flex flex-col gap-1 ${line.from === "you" ? "items-end" : "items-start"}`}
				>
					<span className={LABEL}>{line.from === "you" ? "YOU" : "MACHINE"}</span>
					<span
						className={`max-w-[90%] text-[11.5px] leading-relaxed ${line.from === "you" ? "text-neutral-300" : "text-neutral-100"}`}
					>
						{line.text}
					</span>
				</li>
			))}
		</ol>
	);
}

function MachineChat({ machine }: { machine: MachineSummary }) {
	const { api } = useRouter().options.context;
	const detail = useMachine(api, machine.machineId);
	const record = useRecord(api, machine.machineId);
	const [lines, setLines] = useState<Line[]>([]);
	const ask = (question: Question) => {
		if (!detail.data) return;
		const said = answer(question, detail.data, record.data ?? []);
		setLines((was) => [
			...was,
			{ from: "you", text: question },
			...said.map((text) => ({ from: "machine" as const, text })),
		]);
	};
	return (
		<div className="flex flex-col gap-5">
			<Conversation lines={lines} />
			<div className="flex flex-wrap gap-1.5">
				{QUESTIONS.map((question) => (
					<button
						key={question}
						type="button"
						onClick={() => ask(question)}
						disabled={!detail.data}
						className={CHIP}
					>
						{question}
					</button>
				))}
			</div>
			<input
				disabled
				placeholder="TYPING TO IT ARRIVES WITH THE AI MANAGER"
				className="h-10 border border-white/10 bg-transparent px-3 text-[11px] placeholder:text-neutral-600"
			/>
		</div>
	);
}

/** Floating over the page, or docked as a tool window in the right rail. */
export function ChatPanel({ onClose, docked = false }: { onClose: () => void; docked?: boolean }) {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const [tab, setTab] = useState<"global" | "machines">("machines");
	const [chosen, setChosen] = useState<string>();
	const list = session.data ? (machines.data ?? []) : [];
	const machine = list.find((each) => each.machineId === chosen);
	return (
		<aside
			aria-label="Chat"
			className={
				docked
					? "flex h-full flex-col gap-6 overflow-y-auto overscroll-none p-5"
					: "fixed top-11 right-0 bottom-6 z-40 flex w-[min(380px,100vw)] flex-col gap-6 overflow-y-auto overscroll-none bg-black/75 p-5 backdrop-saturate-0"
			}
		>
			<header className="flex items-center justify-between">
				<div className="flex gap-5 text-[11px] tracking-[0.14em]">
					{(["machines", "global"] as const).map((each) => (
						<button
							key={each}
							type="button"
							onClick={() => setTab(each)}
							aria-pressed={tab === each}
							className={
								tab === each ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
							}
						>
							{each.toUpperCase()}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="text-neutral-500 hover:text-neutral-100"
				>
					<X size={14} weight="light" />
				</button>
			</header>

			{tab === "global" ? (
				<div className="flex flex-1 flex-col justify-end gap-3">
					<p className={LABEL}>THE ROOM FOR EVERYONE RUNNING MACHINES</p>
					<p className="text-[11px] text-neutral-600 tracking-[0.1em]">
						OPENS WITH THE BACKEND PASS
					</p>
					<input
						disabled
						placeholder="SAY SOMETHING"
						className="h-10 border border-white/10 bg-transparent px-3 text-[11px] placeholder:text-neutral-600"
					/>
				</div>
			) : !session.data ? (
				<p className={LABEL}>CONNECT TO TALK TO YOUR MACHINES</p>
			) : (
				<div className="flex flex-col gap-5">
					<ul className="flex flex-wrap gap-1.5">
						{list.map((each) => (
							<li key={each.machineId}>
								<button
									type="button"
									onClick={() => setChosen(each.machineId)}
									aria-pressed={each.machineId === chosen}
									className={`${CHIP} ${each.machineId === chosen ? "bg-white/10" : ""}`}
								>
									{each.name.toUpperCase()}
								</button>
							</li>
						))}
					</ul>
					{machine ? (
						<MachineChat key={machine.machineId} machine={machine} />
					) : (
						<p className={LABEL}>PICK A MACHINE TO TALK TO</p>
					)}
				</div>
			)}
		</aside>
	);
}
