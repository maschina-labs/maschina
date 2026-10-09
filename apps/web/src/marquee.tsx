/**
 * What Maschina is built with, as plain gray names drifting slowly under the hero: no logos, no links, no colors,
 * no heading. Every name is a tool in real use in the repository (the chain and what touches it first, then the
 * platform, then the stack); they are tools, not partners, and nothing here says otherwise. The names run twice
 * end to end so the loop has no gap, and the second run is hidden from assistive technology so each is read once.
 * It is clipped to the page margins, like every other section, and fades out at both of those edges. Anyone who asked for less motion gets it standing still.
 */
const NAMES = [
	"Solana",
	"Turnkey",
	"Helius",
	"Jupiter",
	"Anthropic",
	"DexScreener",
	"Cloudflare",
	"PostgreSQL",
	"Docker",
	"TypeScript",
	"React",
	"Vite",
	"Tailwind CSS",
	"Hono",
	"Drizzle",
	"Zod",
	"Node.js",
	"pnpm",
	"Turborepo",
	"Biome",
	"Vitest",
	"three.js",
] as const;

const LIST = "flex shrink-0 items-center gap-16 pr-16";

export function Marquee() {
	return (
		<section aria-label="Built with" className="relative bg-black px-(--gutter) py-10">
			<div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
				<div className="flex w-max animate-marquee motion-reduce:animate-none">
					<ul className={LIST}>
						{NAMES.map((name) => (
							<li key={name} className="whitespace-nowrap text-[15px] text-neutral-500">
								{name}
							</li>
						))}
					</ul>
					<ul aria-hidden="true" className={LIST}>
						{NAMES.map((name) => (
							<li key={name} className="whitespace-nowrap text-[15px] text-neutral-500">
								{name}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
