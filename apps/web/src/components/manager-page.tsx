import { ArrowUp } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMachines } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { useSession } from "../lib/session.ts";
import { suggestionsFor } from "../lib/suggestions.ts";
import { openEdge } from "./edges.tsx";
import { sentence } from "./home.tsx";

/**
 * The manager: a conversation in the main area, with the left sidebar of machines and conversations open
 * beside it. Until the manager has its key it says so plainly when asked, and shows what it can already
 * see without one: the rule-based notes on your machines.
 */

type Message = { from: "you" | "manager"; text: string };

/** What to ask, for someone who has not asked anything yet. */
const STARTERS = [
	"How are my machines doing?",
	"Should I retune my range finder?",
	"Where should my next machine go?",
	"What did my machines do today?",
];

export function ManagerPage() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const notes = suggestionsFor(session.data ? (machines.data ?? []) : [], price.data?.usd);
	const [messages, setMessages] = useState<Message[]>([]);
	const [draft, setDraft] = useState("");
	const end = useRef<HTMLDivElement>(null);

	// The manager works beside your machines: opening it opens their sidebar.
	useEffect(() => {
		openEdge("left");
	}, []);
	useEffect(() => {
		end.current?.scrollIntoView?.({ block: "end" });
	}, [messages]);

	const ask = (text: string) => {
		const question = text.trim();
		if (!question) return;
		setDraft("");
		setMessages((was) => [
			...was,
			{ from: "you", text: question },
			{
				from: "manager",
				text: "I can't answer yet: I start thinking once my key is set up. Until then, the notes on your machines below are what I can see.",
			},
		]);
	};

	return (
		<div className="flex h-[calc(66cqh+20px)] flex-col gap-4">
			<div
				data-own-drag
				className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
			>
				{messages.length === 0 ? (
					<div className="flex flex-col gap-5 pt-2">
						<p className="font-display text-[clamp(20px,2vw,28px)] text-neutral-100 leading-tight">
							Ask about your machines, the market, or what to do next.
						</p>
						<div className="flex flex-wrap gap-1.5">
							{STARTERS.map((each) => (
								<button
									key={each}
									type="button"
									onClick={() => ask(each)}
									className="bg-white/[0.08] px-3 py-2 text-[14px] text-neutral-200 transition-colors hover:bg-white/[0.14]"
								>
									{each}
								</button>
							))}
						</div>
					</div>
				) : (
					messages.map((message, index) => (
						<div
							// A conversation only grows, so each message's place is its identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							key={index}
							className={`max-w-[75%] px-4 py-3 text-[15px] leading-relaxed ${message.from === "you" ? "self-end bg-white text-neutral-950" : "self-start bg-white/[0.08] text-neutral-100"}`}
						>
							{message.text}
						</div>
					))
				)}
				{notes.length ? (
					<div className="flex flex-col gap-1.5 pt-2">
						<span className="text-[13px] text-neutral-500">Worth a look</span>
						{notes.map((note) => (
							<Link
								key={note.id}
								to="/machines/$machineId"
								params={{ machineId: note.machineId }}
								className="flex flex-col gap-0.5 bg-white/[0.06] px-4 py-3 transition-colors hover:bg-white/[0.12]"
							>
								<span className="text-[15px] text-neutral-100">
									{sentence(note.machine)} · {sentence(note.title).toLowerCase()}
								</span>
								<span className="text-[13px] text-neutral-400">{sentence(note.detail)}</span>
							</Link>
						))}
					</div>
				) : null}
				<div ref={end} />
			</div>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					ask(draft);
				}}
				className="flex items-end gap-2 bg-white/[0.08] p-2"
			>
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							ask(draft);
						}
					}}
					rows={2}
					aria-label="Ask your manager"
					placeholder="Ask your manager"
					className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[16px] text-neutral-100 outline-none placeholder:text-neutral-500"
				/>
				<button
					type="submit"
					aria-label="Send"
					disabled={!draft.trim()}
					className="grid size-10 place-items-center bg-white text-neutral-950 transition-opacity disabled:opacity-30"
				>
					<ArrowUp size={18} weight="bold" />
				</button>
			</form>
		</div>
	);
}
