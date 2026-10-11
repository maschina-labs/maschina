import type { BrandDoc, Logo } from "./company/brand.ts";
import { Frame } from "./frame.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { useTitle } from "./use-title.ts";

const KIT = "/brand/kit";
const BUTTON =
	"inline-flex h-9 items-center bg-white/[0.08] px-4 text-[14px] text-neutral-200 transition-colors hover:bg-white/[0.16] hover:text-white";

/** A section of the page: its name and a few words on the left, what it shows on the right. */
function Row({
	heading,
	body,
	children,
}: {
	heading: string;
	body: string;
	children: React.ReactNode;
}) {
	return (
		<section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16 lg:py-20">
			<div>
				<h2 className="font-display font-medium text-[2rem] text-white leading-tight tracking-[-0.03em]">
					{heading}
				</h2>
				<p className="mt-5 text-[17px] text-neutral-400 leading-[1.65]">{body}</p>
			</div>
			<div>{children}</div>
		</section>
	);
}

/** One logo on a dark or a light tile, with the files to download under it. */
function Tile({ logo, tone }: { logo: Logo; tone: "dark" | "light" }) {
	const m = useMessages().brand;
	const ink = tone === "dark" ? "white" : "black";
	const base = `${KIT}/${logo.file}-${ink}`;
	return (
		<div data-logo data-tone={tone}>
			<div
				className={`grid aspect-[4/3] place-items-center p-6 ${tone === "dark" ? "bg-[#111113]" : "bg-[#f4f4f5]"}`}
			>
				<img
					src={`${base}.svg`}
					alt={`${logo.label}, ${ink}`}
					className={logo.name === "mark" ? "size-16" : "w-4/5"}
				/>
			</div>
			<div className="mt-3 flex gap-2">
				<Link href={`${base}.svg`} download className={BUTTON}>
					{m.svg}
				</Link>
				<Link href={`${base}.png`} download className={BUTTON}>
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
					<div data-head-text className="relative mx-auto w-full max-w-[72rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mt-6 max-w-[40rem] text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
						<Link
							href={doc.pack}
							download
							className="mt-8 inline-flex h-11 items-center gap-3 bg-[oklch(0.93_0.02_300)] px-6 text-[15px] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)]"
						>
							<svg
								data-icon="download"
								viewBox="0 0 20 20"
								className="size-4"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinecap="square"
								aria-hidden="true"
							>
								<path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M3.5 16.5h13" />
							</svg>
							{m.pack}
						</Link>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pb-24 sm:pb-32`}>
					<div className="mx-auto w-full max-w-[72rem]">
						<Row heading={doc.logos.heading} body={doc.logos.body}>
							<div className="grid gap-x-3 gap-y-8 sm:grid-cols-3">
								{(["dark", "light"] as const).flatMap((tone) =>
									doc.logos.items.map((logo) => (
										<Tile key={`${tone}-${logo.name}`} logo={logo} tone={tone} />
									)),
								)}
							</div>
						</Row>
						<Row heading={doc.colors.heading} body={doc.colors.body}>
							<div className="grid gap-3 sm:grid-cols-2">
								{doc.colors.items.map((color) => (
									<div
										key={color.name}
										data-swatch
										style={{ backgroundColor: color.hex }}
										className={`flex min-h-44 flex-col justify-between p-5 ${color.light ? "text-black" : "bg-[#0a0a0a] text-white outline outline-1 outline-white/15"}`}
									>
										<span className="text-[17px]">{color.name}</span>
										<span className="block text-[13px] leading-[1.6]">
											<span className="block">{color.hex}</span>
											<span className="block opacity-70">{color.oklch}</span>
										</span>
									</div>
								))}
							</div>
						</Row>
						<Row heading={doc.clearspace.heading} body={doc.clearspace.body}>
							<div className="space-y-12">
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
						</Row>
						<Row heading={doc.typeface.heading} body={doc.typeface.body}>
							<p className="font-display text-[clamp(3rem,8vw,6rem)] text-white leading-none tracking-[-0.04em]">
								Aa
							</p>
						</Row>
						<Row heading={doc.rules.heading} body={doc.rules.body}>
							<ul className="list-[square] space-y-3 pl-5 marker:text-neutral-600">
								{doc.rules.dont.map((rule) => (
									<li key={rule} className="pl-1 text-[18px] text-neutral-300 leading-[1.6]">
										{rule}
									</li>
								))}
							</ul>
						</Row>
					</div>
				</div>
			</article>
		</Frame>
	);
}
