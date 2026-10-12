import { DownloadSimple, X } from "@phosphor-icons/react";
import type { BrandDoc, Logo } from "./company/brand.ts";
import { Frame } from "./frame.tsx";
import { PANEL } from "./glass.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { SectionHead } from "./section-head.tsx";
import { useTitle } from "./use-title.ts";

const KIT = "/brand/kit";
const BUTTON = "inline-flex h-9 items-center px-4 text-[14px] transition-colors";
const BUTTON_DARK = `${BUTTON} bg-white/[0.08] text-neutral-200 hover:bg-white/[0.16] hover:text-white`;
const BUTTON_LIGHT = `${BUTTON} bg-black/[0.07] text-neutral-800 hover:bg-black/[0.13] hover:text-black`;

/** A section of the page: the same silver headline as the front page, a line under it, and what it shows below, full width. */
function Block({
	heading,
	body,
	children,
}: {
	heading: string;
	body: string;
	children: React.ReactNode;
}) {
	return (
		<section className="py-14 lg:py-20">
			<div className="flex flex-col items-center">
				<SectionHead title={heading} line={body} />
			</div>
			<div className="mt-12">{children}</div>
		</section>
	);
}

/** One logo on a dark or a light tile, with the files to download under it. */
function Tile({ logo, tone, wide }: { logo: Logo; tone: "dark" | "light"; wide: boolean }) {
	const m = useMessages().brand;
	const ink = tone === "dark" ? "white" : "black";
	const base = `${KIT}/${logo.file}-${ink}`;
	return (
		<div data-logo data-tone={tone}>
			<div
				className={`grid ${wide ? "aspect-[16/8]" : "aspect-[4/3]"} place-items-center p-6 ${tone === "dark" ? "bg-[#111113]" : "bg-[#f4f4f5]"}`}
			>
				<img
					src={`${base}.svg`}
					alt={`${logo.label}, ${ink}`}
					className={logo.name === "mark" ? "size-16" : "w-4/5"}
				/>
			</div>
			<div className="flex gap-2 p-4">
				<Link
					href={`${base}.svg`}
					download
					className={tone === "dark" ? BUTTON_DARK : BUTTON_LIGHT}
				>
					{m.svg}
				</Link>
				<Link
					href={`${base}.png`}
					download
					className={tone === "dark" ? BUTTON_DARK : BUTTON_LIGHT}
				>
					{m.png}
				</Link>
			</div>
		</div>
	);
}

/**
 * A logo with its clearspace drawn round it: a grid of cells of size x, the logo in the middle, the four corner cells
 * marked. The wordmark's x is its own height and the mark's is half of its height.
 */
function Clearspace({
	file,
	label,
	caption,
	across,
	down,
}: {
	file: string;
	label: string;
	caption: string;
	/** The logo's width and height in units of x, which is what sets the size of every cell. */
	across: number;
	down: number;
}) {
	return (
		<figure data-clearspace>
			<div
				className="inline-grid bg-white/[0.04]"
				style={{
					gridTemplateColumns: `var(--x) calc(var(--x) * ${across}) var(--x)`,
					gridTemplateRows: `var(--x) calc(var(--x) * ${down}) var(--x)`,
					["--x" as string]: "clamp(1.5rem, 5vw, 3rem)",
				}}
			>
				{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
					if (cell === 4)
						return (
							<div key={cell} className="grid place-items-center">
								<img
									src={`${KIT}/${file}-white.svg`}
									alt={label}
									className="size-full object-contain"
								/>
							</div>
						);
					const corner = cell === 0 || cell === 2 || cell === 6 || cell === 8;
					return (
						<div
							key={cell}
							aria-hidden="true"
							className={`grid place-items-center text-[13px] text-neutral-400 ${corner ? "bg-white/[0.08]" : ""}`}
						>
							{corner ? "x" : ""}
						</div>
					);
				})}
			</div>
			<figcaption className="mt-4 text-[15px] text-neutral-400">{caption}</figcaption>
		</figure>
	);
}

const wordmark = `${KIT}/wordmark-white.svg`;
const letters = `${KIT}/word-white.svg`;
const markOnly = `${KIT}/mark-white.svg`;

/** The pictures of what not to do, in the order the rules are written: stretched, recolored, on a busy image, rearranged, and implying a partner. */
const MISUSE: { picture: React.ReactNode; busy?: boolean }[] = [
	{
		picture: (
			<img src={wordmark} alt="" className="w-3/5 -rotate-[14deg] scale-x-[1.35] scale-y-[0.7]" />
		),
	},
	{
		picture: (
			<img
				src={wordmark}
				alt=""
				className="w-3/5 [filter:drop-shadow(3px_3px_0_oklch(0.7_0.2_20))_drop-shadow(-3px_-3px_0_oklch(0.75_0.15_240))]"
			/>
		),
	},
	{ picture: <img src={wordmark} alt="" className="w-3/5" />, busy: true },
	{
		picture: (
			<div className="flex items-center gap-3">
				<img src={letters} alt="" className="w-28" />
				<img src={markOnly} alt="" className="size-9" />
			</div>
		),
	},
	{
		picture: (
			<div className="flex items-center gap-3">
				<img src={wordmark} alt="" className="w-28" />
				<span className="text-[22px] text-neutral-500">+</span>
				<span className="size-9 border border-white/30" />
			</div>
		),
	},
];

function Misuse({ rules }: { rules: string[] }) {
	return (
		<ul className="flex flex-wrap justify-center gap-x-6 gap-y-10">
			{rules.map((rule, index) => {
				const example = MISUSE[index] ?? MISUSE[0];
				return (
					<li
						key={rule}
						data-misuse
						className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
					>
						<div
							className={`relative grid aspect-[4/3] place-items-center overflow-hidden ${PANEL} ${example?.busy ? "bg-[repeating-conic-gradient(#3a3a3f_0%_25%,#8a8a92_0%_50%)] bg-[length:28px_28px]" : "bg-[#111113]"}`}
						>
							{example?.picture}
							<span
								data-cross
								aria-hidden="true"
								className="absolute top-3 right-3 grid size-7 place-items-center bg-[oklch(0.93_0.02_300)] text-black"
							>
								<X weight="bold" className="size-3" aria-hidden="true" />
							</span>
						</div>
						<p className="mt-4 text-[16px] text-neutral-300 leading-[1.55]">{rule}</p>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * The brand assets page, set out like a brand kit: the held mesh head with the full pack to download, then rows of a
 * name and a few words on the left and what they are about on the right: logos to download, colors, clearspace, the
 * typeface and what not to do.
 */
export function BrandPage({ authUrl, doc }: { authUrl: string; doc: BrandDoc }) {
	const m = useMessages().brand;
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full text-center max-w-[72rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mx-auto mt-6 max-w-[40rem] text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
						<Link
							href={doc.pack}
							download
							className="mt-8 inline-flex h-11 items-center gap-4 silver-button pr-1.5 pl-6 text-[15px] text-black"
						>
							<span>{m.pack}</span>
							<span data-chip className="grid size-8 place-items-center bg-black text-white">
								<DownloadSimple
									data-icon="download"
									weight="regular"
									className="size-4"
									aria-hidden="true"
								/>
							</span>
						</Link>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pb-24 sm:pb-32`}>
					<div className="mx-auto w-full max-w-[72rem]">
						<Block heading={doc.logos.heading} body={doc.logos.body}>
							<div className="grid gap-6 lg:grid-cols-2">
								{doc.logos.items.map((logo, index) => (
									<figure
										key={logo.name}
										data-specimen
										className={`${PANEL} ${index === 0 ? "lg:col-span-2" : ""}`}
									>
										<figcaption className="px-5 pt-4 pb-3 text-[14px] text-neutral-400">
											{logo.label}
										</figcaption>
										<div className="grid grid-cols-2">
											{(["dark", "light"] as const).map((tone) => (
												<div key={tone} className={tone === "light" ? "bg-[#f4f4f5]" : ""}>
													<Tile logo={logo} tone={tone} wide={index === 0} />
												</div>
											))}
										</div>
									</figure>
								))}
							</div>
						</Block>
						<Block heading={doc.colors.heading} body={doc.colors.body}>
							<div data-spectrum className="flex flex-col gap-1 lg:flex-row">
								{doc.colors.items.map((color) => (
									<div
										key={color.name}
										data-swatch
										style={{ backgroundColor: color.hex }}
										className={`flex min-h-52 flex-1 flex-col justify-between p-6 transition-[flex-grow] duration-500 ease-out lg:min-h-96 lg:hover:flex-[2.2] ${color.light ? "text-black" : "bg-[#0a0a0a] text-white outline outline-1 outline-white/15"}`}
									>
										<span className="text-[19px]">{color.name}</span>
										<span className="block text-[13px] leading-[1.6]">
											<span className="block">{color.hex}</span>
											<span className="block opacity-70">{color.oklch}</span>
										</span>
									</div>
								))}
							</div>
						</Block>
						<Block heading={doc.clearspace.heading} body={doc.clearspace.body}>
							<div className={`grid gap-12 p-8 lg:grid-cols-2 lg:p-12 ${PANEL}`}>
								<Clearspace
									file="wordmark"
									label="Wordmark with clearspace"
									caption={m.clearspaceWordmark}
									across={1284 / 175}
									down={1}
								/>
								<Clearspace
									file="mark"
									label="Mark with clearspace"
									caption={m.clearspaceMark}
									across={2}
									down={2}
								/>
							</div>
						</Block>
						<Block heading={doc.typeface.heading} body={doc.typeface.body}>
							<div
								data-specimen-type
								className={`grid items-center gap-10 p-8 lg:grid-cols-[auto_1fr] lg:gap-16 lg:p-12 ${PANEL}`}
							>
								<div className="flex items-baseline gap-8 font-display text-white leading-none tracking-[-0.04em]">
									<span className="font-normal text-[clamp(5rem,12vw,9rem)]">Aa</span>
									<span className="font-medium text-[clamp(5rem,12vw,9rem)]">Aa</span>
								</div>
								<div className="space-y-3 font-display text-[clamp(1.125rem,2.2vw,1.625rem)] text-neutral-300 leading-snug tracking-[-0.01em]">
									<p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
									<p>abcdefghijklmnopqrstuvwxyz</p>
									<p>0123456789</p>
								</div>
							</div>
						</Block>
						<Block heading={doc.rules.heading} body={doc.rules.body}>
							<Misuse rules={doc.rules.dont} />
						</Block>
					</div>
				</div>
			</article>
		</Frame>
	);
}
