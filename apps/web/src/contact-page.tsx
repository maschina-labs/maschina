import { Check } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { CONTACT_TOPICS, type ContactMessage, sendMessage } from "./contact-send.ts";
import { Frame } from "./frame.tsx";
import { ArrowChip, PANEL } from "./glass.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { rich } from "./i18n/rich.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { PAGE_SHEET, PageStrip } from "./page-strip.tsx";
import { useTitle } from "./use-title.ts";

/** Where the API lives: api.maschina.dev, or the local gateway while developing (.env). */
const API = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";

/** A field set on a line, with nothing round about it. */
const FIELD =
	"block w-full border-white/[0.18] border-b bg-transparent px-0 text-[17px] text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/70";

/** The address a message for a topic goes to: the same one the API sends it to. */
const addressFor = (topic: string) => `${topic}@maschina.dev`;

/**
 * The contact page: a form that sends one email, through the API, to the role address for the topic chosen. The four
 * addresses are the page: each is a line of large type, and the one you pick opens into the form right under it. What was
 * typed stays when you pick another. It says what happened in plain words, keeps what was typed when sending fails, and
 * never sends twice. A field no person sees catches programs that fill every field.
 */
export function ContactPage({ authUrl }: { authUrl: string }) {
	const m = useMessages().contact;
	useTitle(m.title);
	const id = useId();
	const [topic, setTopic] = useState<ContactMessage["topic"]>("support");
	const [fields, setFields] = useState({ name: "", email: "", message: "" });
	const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
	const [problem, setProblem] = useState<string | null>(null);
	// Opening one address closes the one that was open, so the page moves under you. Bring the new one to the top of the
	// view, under the header, so you never have to scroll to find where you are. Not on the first view of the page.
	const rows = useRef<Record<string, HTMLDivElement | null>>({});
	const shown = useRef(topic);
	useEffect(() => {
		if (shown.current === topic) return;
		shown.current = topic;
		const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		rows.current[topic]?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
	}, [topic]);
	const set = (name: keyof typeof fields) => (event: { target: { value: string } }) =>
		setFields((now) => ({ ...now, [name]: event.target.value }));

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (state === "sending") return;
		const data = new FormData(event.currentTarget);
		setState("sending");
		setProblem(null);
		const result = await sendMessage(API, {
			topic,
			name: fields.name,
			email: fields.email,
			message: fields.message,
			website: String(data.get("website") ?? ""),
		});
		if (result.ok) {
			setState("sent");
			return;
		}
		setState("idle");
		setProblem(m.problems[result.reason]);
	}

	return (
		<Frame authUrl={authUrl} framed={false}>
			<article className="page-frame w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full text-center max-w-[64rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{m.title}
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{m.standfirst}
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} ${PAGE_SHEET} pb-24 sm:pb-32`}>
					<PageStrip />
					<div data-content className="mx-auto w-full max-w-[64rem]">
						{state === "sent" ? (
							<div role="status" className={`p-8 sm:p-12 ${PANEL}`}>
								<span
									aria-hidden="true"
									className="grid size-12 place-items-center bg-[oklch(0.93_0.02_300)] text-black"
								>
									<Check weight="bold" className="size-5" aria-hidden="true" />
								</span>
								<h2 className="mt-8 font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em]">
									{m.sentTitle}
								</h2>
								<p className="mt-5 text-[19px] text-neutral-300 leading-[1.6]">{m.sentBody}</p>
							</div>
						) : (
							<form onSubmit={submit}>
								<fieldset>
									<legend id={`${id}-who`} className="mb-5 text-[14px] text-neutral-500">
										{m.who}
									</legend>
									<div
										role="radiogroup"
										aria-labelledby={`${id}-who`}
										className="border-white/[0.1] border-t"
									>
										{CONTACT_TOPICS.map((value, index) => {
											const open = topic === value;
											return (
												<div
													key={value}
													ref={(node) => {
														rows.current[value] = node;
													}}
													data-inbox
													data-open={open}
													className="scroll-mt-24 border-white/[0.1] border-b"
												>
													<label className="group flex cursor-pointer items-center gap-5 py-6 sm:gap-8">
														<input
															type="radio"
															name="topic"
															value={value}
															checked={open}
															onChange={() => setTopic(value)}
															className="sr-only"
														/>
														<span
															aria-hidden="true"
															className="w-7 shrink-0 text-[13px] text-neutral-500 tabular-nums"
														>
															{String(index + 1).padStart(2, "0")}
														</span>
														<span className="min-w-0 flex-1">
															<span
																data-address
																{...(open ? { "data-recipient": true } : {})}
																className={`block break-words font-display font-medium text-[clamp(1.375rem,4vw,3rem)] leading-[1.05] tracking-[-0.04em] transition-colors ${open ? "text-white" : "text-white/40 group-hover:text-white/75"}`}
															>
																{addressFor(value)}
															</span>
															<span className="mt-2 block text-[15px] text-neutral-500">
																{m.topics[value].label}
																<span aria-hidden="true"> · </span>
																{m.topics[value].hint}
															</span>
														</span>
														<ArrowChip
															direction="next"
															className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`}
														/>
													</label>
													{open ? (
														<div className="space-y-7 pr-0 pb-10 sm:pl-[3.75rem]">
															<div className="grid gap-7 sm:grid-cols-2">
																<div>
																	<label
																		htmlFor={`${id}-name`}
																		className="text-[13px] text-neutral-500"
																	>
																		{m.name}
																	</label>
																	<input
																		id={`${id}-name`}
																		name="name"
																		required
																		maxLength={100}
																		autoComplete="name"
																		value={fields.name}
																		onChange={set("name")}
																		className={`${FIELD} mt-2 h-11`}
																	/>
																</div>
																<div>
																	<label
																		htmlFor={`${id}-email`}
																		className="text-[13px] text-neutral-500"
																	>
																		{m.email}
																	</label>
																	<input
																		id={`${id}-email`}
																		name="email"
																		type="email"
																		required
																		maxLength={200}
																		autoComplete="email"
																		value={fields.email}
																		onChange={set("email")}
																		className={`${FIELD} mt-2 h-11`}
																	/>
																</div>
															</div>
															<div>
																<label
																	htmlFor={`${id}-message`}
																	className="text-[13px] text-neutral-500"
																>
																	{m.message}
																</label>
																<textarea
																	id={`${id}-message`}
																	name="message"
																	required
																	minLength={10}
																	maxLength={5000}
																	rows={7}
																	value={fields.message}
																	onChange={set("message")}
																	className={`${FIELD} mt-2 resize-y py-2 leading-[1.7]`}
																/>
															</div>
															{problem ? (
																<p
																	role="alert"
																	className="text-[16px] text-neutral-200 leading-[1.5]"
																>
																	{problem}
																</p>
															) : null}
															<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
																<button
																	type="submit"
																	disabled={state === "sending"}
																	className="inline-flex h-11 items-center gap-4 silver-button pr-1.5 pl-6 text-[15px] text-black disabled:opacity-60"
																>
																	<span>{state === "sending" ? m.sending : m.send}</span>
																	<ArrowChip tone="black" direction="next" />
																</button>
																<p className="text-[14px] text-neutral-500">
																	{rich(m.securityNote, {
																		link: (
																			<Link
																				href="/disclosure"
																				className="text-neutral-200 underline decoration-white/30 underline-offset-4 hover:decoration-white"
																			>
																				{m.securityLink}
																			</Link>
																		),
																	})}
																</p>
															</div>
														</div>
													) : null}
												</div>
											);
										})}
									</div>
								</fieldset>
								{/* A field no person sees or fills. A program that fills every field gives itself away. */}
								<div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
									<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
								</div>
							</form>
						)}
					</div>
				</div>
			</article>
		</Frame>
	);
}
