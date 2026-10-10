import { useId, useState } from "react";
import { CONTACT_TOPICS, type ContactMessage, type Sent, sendMessage } from "./contact-send.ts";
import { Frame } from "./frame.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { useTitle } from "./use-title.ts";

/** Where the API lives: api.maschina.dev, or the local gateway while developing (.env). */
const API = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";

const TOPICS: Record<(typeof CONTACT_TOPICS)[number], { label: string; hint: string }> = {
	support: { label: "Support", hint: "Help using Maschina" },
	billing: { label: "Billing", hint: "A charge or a fee" },
	legal: { label: "Legal", hint: "Terms, privacy, license" },
	abuse: { label: "Abuse", hint: "Report a breach of the rules" },
};

const PROBLEM: Record<Exclude<Sent, { ok: true }>["reason"], string> = {
	invalid:
		"Check the fields: the email needs to be a real address, and the message a few words at least.",
	limit: "Too many messages from this address. Please wait a minute and try again.",
	unavailable: "Your message cannot be sent right now. Write to support@maschina.dev instead.",
	network:
		"Your message cannot be sent right now. Check your connection, or write to support@maschina.dev instead.",
};

const FIELD =
	"block w-full bg-white/[0.06] px-4 text-[17px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:bg-white/[0.1] focus-visible:ring-1 focus-visible:ring-white/40";

/**
 * The contact page: a form that sends one email, through the API, to the role address for the topic chosen. It has the
 * same held head and black sheet as the other pages. It says what happened in plain words, keeps what was typed when
 * sending fails, and never sends twice. A field no person sees catches programs that fill every field.
 */
export function ContactPage({ authUrl }: { authUrl: string }) {
	useTitle("Contact");
	const id = useId();
	const [topic, setTopic] = useState<ContactMessage["topic"]>("support");
	const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
	const [problem, setProblem] = useState<string | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (state === "sending") return;
		const data = new FormData(event.currentTarget);
		const text = (name: string) => String(data.get(name) ?? "");
		setState("sending");
		setProblem(null);
		const result = await sendMessage(API, {
			topic,
			name: text("name"),
			email: text("email"),
			message: text("message"),
			website: text("website"),
		});
		if (result.ok) {
			setState("sent");
			return;
		}
		setState("idle");
		setProblem(PROBLEM[result.reason]);
	}

	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full max-w-[64rem]">
						<p className="text-[14px] text-neutral-400">Company</p>
						<h1 className="mt-5 font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							Contact
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							Tell us what you need, and it goes to the right inbox.
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pt-14 pb-24 sm:pt-20 sm:pb-32`}>
					<div data-content className="mx-auto w-full max-w-[64rem]">
						{state === "sent" ? (
							<div role="status">
								<h2 className="font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em]">
									Message sent.
								</h2>
								<p className="mt-5 text-[19px] text-neutral-300 leading-[1.6]">
									Replies go to the address you gave.
								</p>
							</div>
						) : (
							<form onSubmit={submit} className="space-y-8">
								<fieldset>
									<legend id={`${id}-who`} className="text-[14px] text-neutral-500">
										Who is it for
									</legend>
									<div
										role="radiogroup"
										aria-labelledby={`${id}-who`}
										className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
									>
										{CONTACT_TOPICS.map((value) => (
											<label
												key={value}
												className={`cursor-pointer px-4 py-3 transition-colors ${topic === value ? "bg-white/[0.14] text-white" : "bg-white/[0.06] text-neutral-400 hover:bg-white/[0.1]"}`}
											>
												<input
													type="radio"
													name="topic"
													value={value}
													checked={topic === value}
													onChange={() => setTopic(value)}
													className="sr-only"
												/>
												<span className="block text-[16px]">{TOPICS[value].label}</span>
												<span className="mt-1 block text-[13px] text-neutral-500">
													{TOPICS[value].hint}
												</span>
											</label>
										))}
									</div>
								</fieldset>
								<div className="grid gap-8 sm:grid-cols-2">
									<div>
										<label htmlFor={`${id}-name`} className="text-[14px] text-neutral-500">
											Your name
										</label>
										<input
											id={`${id}-name`}
											name="name"
											required
											maxLength={100}
											autoComplete="name"
											className={`${FIELD} mt-3 h-12`}
										/>
									</div>
									<div>
										<label htmlFor={`${id}-email`} className="text-[14px] text-neutral-500">
											Your email
										</label>
										<input
											id={`${id}-email`}
											name="email"
											type="email"
											required
											maxLength={200}
											autoComplete="email"
											className={`${FIELD} mt-3 h-12`}
										/>
									</div>
								</div>
								<div>
									<label htmlFor={`${id}-message`} className="text-[14px] text-neutral-500">
										Your message
									</label>
									<textarea
										id={`${id}-message`}
										name="message"
										required
										minLength={10}
										maxLength={5000}
										rows={8}
										className={`${FIELD} mt-3 resize-y py-3 leading-[1.6]`}
									/>
								</div>
								{/* A field no person sees or fills. A program that fills every field gives itself away. */}
								<div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
									<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
								</div>
								{problem ? (
									<p role="alert" className="text-[16px] text-neutral-200 leading-[1.5]">
										{problem}
									</p>
								) : null}
								<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
									<button
										type="submit"
										disabled={state === "sending"}
										className="inline-flex h-11 items-center bg-[oklch(0.93_0.02_300)] px-6 text-[15px] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] disabled:opacity-60"
									>
										{state === "sending" ? "Sending" : "Send message"}
									</button>
									<p className="text-[14px] text-neutral-500">
										A security problem? Use the{" "}
										<a
											href="/disclosure"
											className="text-neutral-200 underline decoration-white/30 underline-offset-4 hover:decoration-white"
										>
											security disclosure
										</a>{" "}
										page instead.
									</p>
								</div>
							</form>
						)}
					</div>
				</div>
			</article>
		</Frame>
	);
}
