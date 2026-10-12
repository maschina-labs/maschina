import { DownloadSimple, Play, Presentation } from "@phosphor-icons/react";
import type { PapersDoc } from "./company/papers.ts";
import { Frame } from "./frame.tsx";
import { ArrowChip, PANEL } from "./glass.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { useTitle } from "./use-title.ts";

type Item = PapersDoc["groups"][number]["items"][number];

/** A faint grid, like the paper a screen is drawn on. */
const GRID =
	"bg-[linear-gradient(oklch(1_0_0/0.045)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.045)_1px,transparent_1px)] bg-[length:32px_32px]";

/** What sits in the middle of a screen: a play button for a video, a stack of slides for a deck. */
function Glyph({ kind }: { kind: "videos" | "decks" }) {
	return (
		<span
			aria-hidden="true"
			className="grid size-16 place-items-center bg-[oklch(0.93_0.02_300)] text-black"
		>
			{kind === "videos" ? (
				<Play weight="fill" className="size-7" aria-hidden="true" />
			) : (
				<Presentation weight="regular" className="size-8" aria-hidden="true" />
			)}
		</span>
	);
}

/** A video or a deck: a screen of its own in a 16 by 9 frame, with its name and what it is under it. */
function ScreenItem({ item, kind, soon }: { item: Item; kind: "videos" | "decks"; soon: string }) {
	const inside = (
		<>
			<span
				data-screen
				className={`relative grid aspect-video place-items-center overflow-hidden ${PANEL} ${GRID}`}
			>
				<Glyph kind={kind} />
				{item.href ? (
					<ArrowChip className="absolute right-4 bottom-4" />
				) : (
					<span
						data-soon
						className="absolute top-4 left-4 bg-white/[0.08] px-2.5 py-1 text-[12px] text-neutral-300"
					>
						{soon}
					</span>
				)}
			</span>
			<span
				data-name
				className="mt-5 block font-display font-medium text-[1.375rem] text-white tracking-[-0.015em]"
			>
				{item.name}
			</span>
			{item.body ? (
				<span className="mt-2 block text-[16px] text-neutral-400 leading-[1.55]">{item.body}</span>
			) : null}
		</>
	);
	return item.href ? (
		<Link
			data-item
			href={item.href}
			target="_blank"
			rel="noopener noreferrer"
			className="group block transition-opacity hover:opacity-90"
		>
			{inside}
		</Link>
	) : (
		<div data-item>{inside}</div>
	);
}

/** A paper or a figure: one row of a contents list, its number large on the left and whether it is ready on the right. */
function RowItem({ item, soon }: { item: Item; soon: string }) {
	const inside = (
		<>
			{item.number ? (
				<span
					data-number
					className="font-display text-[clamp(1.5rem,3vw,2.25rem)] text-white/30 tabular-nums leading-none tracking-[-0.03em] transition-colors group-hover:text-white"
				>
					{item.number}
				</span>
			) : (
				<span aria-hidden="true" />
			)}
			<span className="block">
				<span
					data-name
					className="block font-display font-medium text-[clamp(1.25rem,2.2vw,1.625rem)] text-white tracking-[-0.02em]"
				>
					{item.name}
				</span>
				{item.body ? (
					<span className="mt-1.5 block text-[16px] text-neutral-400 leading-[1.55]">
						{item.body}
					</span>
				) : null}
			</span>
			{item.href ? (
				<ArrowChip />
			) : (
				<span data-soon className="text-[13px] text-neutral-500">
					{soon}
				</span>
			)}
		</>
	);
	const row =
		"grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-5 border-b border-white/[0.1] py-6 sm:grid-cols-[5rem_1fr_auto] sm:gap-x-8";
	return item.href ? (
		<Link
			data-item
			href={item.href}
			target="_blank"
			rel="noopener noreferrer"
			className={`group ${row} transition-colors hover:bg-white/[0.03]`}
		>
			{inside}
		</Link>
	) : (
		<div data-item className={`group ${row}`}>
			{inside}
		</div>
	);
}

const DOWNLOAD_ICON = (
	<DownloadSimple data-icon="download" weight="regular" className="size-4" aria-hidden="true" />
);

/**
 * The one button that downloads everything on the page, figures included, set like the brand page's: a pearl button with
 * a black chip and a white download icon. Until the file exists it is shown and says so, but it is not a link.
 */
function Download({
	href,
	label,
	soon,
}: {
	href: string | undefined;
	label: string;
	soon: string;
}) {
	const chip = (tone: string) => (
		<span data-chip className={`grid size-8 place-items-center ${tone}`}>
			{DOWNLOAD_ICON}
		</span>
	);
	return href ? (
		<Link
			data-download
			href={href}
			download
			className="mt-8 inline-flex h-11 items-center gap-4 bg-[oklch(0.93_0.02_300)] pr-1.5 pl-6 text-[15px] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)]"
		>
			<span>{label}</span>
			{chip("bg-black text-white")}
		</Link>
	) : (
		<span
			data-download
			aria-disabled="true"
			className="mt-8 inline-flex h-11 items-center gap-4 bg-white/[0.08] pr-1.5 pl-6 text-[15px] text-neutral-400"
		>
			<span>{label}</span>
			<span className="bg-white/[0.08] px-2 py-0.5 text-[12px] text-neutral-300">{soon}</span>
			{chip("bg-black/60 text-white/60")}
		</span>
	);
}

/**
 * The papers page: a place for each video, deck and paper Maschina Labs means to publish. A video or a deck is a screen
 * of its own; the papers are a numbered contents list. A place that is not ready says Coming soon quietly and is not a
 * link, so there is no dead link; the moment it has an address it gets a pearl chip and becomes one.
 */
export function PapersPage({ authUrl, doc }: { authUrl: string; doc: PapersDoc }) {
	const messages = useMessages();
	const m = messages.papers;
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full text-center max-w-[64rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mx-auto mt-6 max-w-[40rem] text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
						<Download href={doc.pack} label={messages.downloads.papers} soon={m.soon} />
					</div>
				</div>
				<div data-sheet className={`${SHEET} pt-14 pb-24 sm:pt-20 sm:pb-32`}>
					<div className="mx-auto w-full max-w-[64rem] space-y-20">
						{doc.groups.map((group) => {
							const screens = group.id === "videos" || group.id === "decks";
							return (
								<section key={group.heading}>
									<h2 className="font-display font-medium text-[clamp(1.75rem,3vw,2.25rem)] text-white leading-tight tracking-[-0.03em]">
										{group.heading}
									</h2>
									<div
										data-group={group.id}
										className={
											screens
												? "mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2"
												: "mt-6 border-white/[0.1] border-t"
										}
									>
										{group.items.map((item) =>
											screens ? (
												<ScreenItem
													key={item.name}
													item={item}
													kind={group.id === "videos" ? "videos" : "decks"}
													soon={m.soon}
												/>
											) : (
												<RowItem key={item.name} item={item} soon={m.soon} />
											),
										)}
									</div>
								</section>
							);
						})}
					</div>
				</div>
			</article>
		</Frame>
	);
}
