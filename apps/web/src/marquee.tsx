/**
 * What Maschina is built with, as the tools' own logos in the page's quiet gray, drifting slowly under the hero,
 * with the words "Built with" above them so it reads as a list of tools and not as partners or customers. Every
 * name is a tool in real use in the repository (the chain and what touches it first, then the platform, then the
 * stack). The four whose own logo file already holds the name (Solana, Turnkey, Helius, Jupiter) are shown as
 * that logo alone; the rest are shown as their mark with the name beside it; DexScreener has no logo file of its
 * own to use, so its name is set in type. Nothing is a link, and nothing changes color. The row runs twice end to
 * end so the loop has no gap, and the second run is hidden from assistive technology so each is read once. It is
 * clipped to the page margins, like every other section, and fades out at both of those edges. Anyone who asked for
 * less motion gets it standing still. The logos are the companies' own files and marks.
 */
const DIR = "/brand/built-with";
const GRAY = "[filter:grayscale(1)_brightness(0.6)]";

type Tool =
	| { name: string; kind: "image"; file: string; height: string }
	| { name: string; kind: "lockup-mask"; file: string; size: string }
	| { name: string; kind: "mark"; file: string }
	| { name: string; kind: "type" };

const TOOLS: Tool[] = [
	{ name: "Solana", kind: "image", file: "solana", height: "h-6" },
	{ name: "Turnkey", kind: "lockup-mask", file: "turnkey", size: "h-6 w-[90px]" },
	{ name: "Helius", kind: "image", file: "helius", height: "h-6" },
	{ name: "Jupiter", kind: "image", file: "jupiter", height: "h-7" },
	{ name: "Anthropic", kind: "mark", file: "anthropic" },
	{ name: "Cloudflare", kind: "mark", file: "cloudflare" },
	{ name: "PostgreSQL", kind: "mark", file: "postgresql" },
	{ name: "Docker", kind: "mark", file: "docker" },
	{ name: "TypeScript", kind: "mark", file: "typescript" },
	{ name: "React", kind: "mark", file: "react" },
	{ name: "Vite", kind: "mark", file: "vite" },
	{ name: "Tailwind CSS", kind: "mark", file: "tailwindcss" },
	{ name: "Hono", kind: "mark", file: "hono" },
	{ name: "Drizzle", kind: "mark", file: "drizzle" },
	{ name: "Zod", kind: "mark", file: "zod" },
	{ name: "Node.js", kind: "mark", file: "nodedotjs" },
	{ name: "pnpm", kind: "mark", file: "pnpm" },
	{ name: "Turborepo", kind: "mark", file: "turborepo" },
	{ name: "Biome", kind: "mark", file: "biome" },
	{ name: "Vitest", kind: "mark", file: "vitest" },
	{ name: "three.js", kind: "mark", file: "threedotjs" },
	{ name: "DexScreener", kind: "type" },
];

const mask = (file: string) => {
	const url = `url(${DIR}/${file}.svg) center / contain no-repeat`;
	return { WebkitMask: url, mask: url };
};

function Row() {
	return TOOLS.map((tool) => (
		<li
			key={tool.name}
			className="flex shrink-0 items-center gap-3 whitespace-nowrap text-neutral-500"
		>
			{tool.kind === "image" ? (
				<>
					<img
						src={`${DIR}/${tool.file}.svg`}
						alt=""
						className={`w-auto shrink-0 ${tool.height} ${GRAY}`}
					/>
					<span className="sr-only">{tool.name}</span>
				</>
			) : null}
			{tool.kind === "lockup-mask" ? (
				<>
					<span
						data-logo
						aria-hidden="true"
						style={mask(tool.file)}
						className={`shrink-0 bg-neutral-500 ${tool.size}`}
						role="presentation"
					/>
					<span className="sr-only">{tool.name}</span>
				</>
			) : null}
			{tool.kind === "mark" ? (
				<>
					<span
						data-logo
						aria-hidden="true"
						style={mask(tool.file)}
						className="size-6 shrink-0 bg-neutral-500"
					/>
					<span className="text-[clamp(1.125rem,1.8vw,1.5rem)] tracking-[-0.02em]">
						{tool.name}
					</span>
				</>
			) : null}
			{tool.kind === "type" ? (
				<span className="text-[clamp(1.125rem,1.8vw,1.5rem)] tracking-[-0.02em]">{tool.name}</span>
			) : null}
		</li>
	));
}

const LIST = "flex shrink-0 items-center gap-16 pr-16";

export function Marquee() {
	return (
		<section aria-label="Built with" className="relative bg-black px-(--gutter) py-10">
			<p className="text-center text-[13px] text-neutral-500">Built with</p>
			<div
				data-frame
				className="mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
			>
				<div className="flex w-max animate-marquee motion-reduce:animate-none">
					<ul className={LIST}>
						<Row />
					</ul>
					<ul aria-hidden="true" className={LIST}>
						<Row />
					</ul>
				</div>
			</div>
		</section>
	);
}
