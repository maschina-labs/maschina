import { ArrowUp } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/machines.ts";
import { useManagerKey } from "../lib/manager-key.ts";
import { useSession } from "../lib/session.ts";
import { openEdge } from "./edges.tsx";
import { TraderPanel } from "./trader-panel.tsx";

/**
 * The manager: a conversation in the main area, with the left sidebar of machines and conversations open
 * beside it, and nothing else on the page. It thinks on the owner's own key, set in settings, and each answer says what it cost. The
 * conversation lives only in this page: the gateway keeps nothing between turns.
 */

type Message = { from: "you" | "manager"; text: string; costUsd?: number; failed?: boolean };

type Answer = { reply: string; costUsd: number; looked: { tool: string; ok: boolean }[] };

async function askManager(
	api: ReturnType<typeof useRouter>["options"]["context"]["api"],
	messages: Message[],
) {
	const response = await api.v1.manager.messages.$post({
		json: {
			messages: messages
				.filter((each) => !each.failed)
				.map((each) => ({ role: each.from, text: each.text })),
		},
	});
	if (response.ok) return (await response.json()) as Answer;
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: string } }
		| undefined;
	throw new ApiError(
		body?.error?.message ?? `The API answered ${response.status}.`,
		response.status,
	);
}

const cents = (dollars: number) => (dollars < 0.01 ? "under 1¢" : `${(dollars * 100).toFixed(1)}¢`);

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
	const key = useManagerKey(api, Boolean(session.data));
	const [messages, setMessages] = useState<Message[]>([]);
	const thinking = useMutation({
		mutationFn: (conversation: Message[]) => askManager(api, conversation),
		onSuccess: (answer) =>
			setMessages((was) => [
				...was,
				{ from: "manager", text: answer.reply, costUsd: answer.costUsd },
			]),
		onError: (error) =>
			setMessages((was) => [...was, { from: "manager", text: error.message, failed: true }]),
	});
	const spent = messages.reduce((sum, each) => sum + (each.costUsd ?? 0), 0);
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
		if (!question || thinking.isPending) return;
		setDraft("");
		const conversation = [...messages, { from: "you" as const, text: question }];
		setMessages(conversation);
		thinking.mutate(conversation);
	};
	const ready = Boolean(session.data && key.data?.set);

	return (
		<div className="grid h-[calc(66cqh+20px)] gap-4 md:grid-cols-[3fr_2fr]">
			<div className="flex min-h-0 flex-col gap-4">
				<div
					data-own-drag
					className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
				>
					{!session.data ? (
						<p className="pt-2 text-[15px] text-neutral-400">Connect to talk to your manager.</p>
					) : key.isSuccess && !key.data.set ? (
						<div className="flex flex-col gap-3 pt-2">
							<p className="font-display text-[clamp(20px,2vw,28px)] text-neutral-100 leading-tight">
								Your manager thinks with your own Anthropic key.
							</p>
							<Link
								to="/settings"
								className="self-start bg-white px-4 py-2 text-[14px] text-neutral-950"
							>
								Add it in settings
							</Link>
						</div>
					) : messages.length === 0 ? (
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
								key={index}
								className={`max-w-[75%] whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed ${message.from === "you" ? "self-end bg-white text-neutral-950" : message.failed ? "self-start border border-white/20 text-neutral-300" : "self-start bg-white/[0.08] text-neutral-100"}`}
							>
								{message.text}
								{message.costUsd !== undefined ? (
									<span className="mt-1.5 block text-[12px] text-neutral-500">
										{cents(message.costUsd)}
									</span>
								) : null}
							</div>
						))
					)}
					{thinking.isPending ? (
						<div role="status" className="self-start px-4 py-3 text-[15px] text-neutral-500">
							Thinking
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
						disabled={!ready}
						aria-label="Ask your manager"
						placeholder="Ask your manager"
						className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[16px] text-neutral-100 outline-none placeholder:text-neutral-500"
					/>
					<button
						type="submit"
						aria-label="Send"
						disabled={!ready || !draft.trim() || thinking.isPending}
						className="grid size-10 place-items-center bg-white text-neutral-950 transition-opacity disabled:opacity-30"
					>
						<ArrowUp size={18} weight="bold" />
					</button>
				</form>
				{spent > 0 ? (
					<p className="-mt-2 text-right text-[12px] text-neutral-500">
						This conversation: {cents(spent)}
					</p>
				) : null}
			</div>
			{ready ? <TraderPanel api={api} /> : null}
		</div>
	);
}
