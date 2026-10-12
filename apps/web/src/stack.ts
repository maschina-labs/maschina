/**
 * Everything Maschina is really built with, as the logo of each, in two rows. Each is the company's or project's own
 * published logo file, unmodified: the whole logo, mark and wordmark, where one is published, and the mark alone where
 * that is all there is. `w` and `h` are the size it is shown at, in pixels. Jupiter publishes a grayscale logo of its own,
 * so that is its resting state (`gray`); the others are shown gray by a filter and in their own colors on hover.
 *
 * The first row is the chain and what Maschina runs on; the second is what the code is written with. Keep it to what the
 * repository really uses: no AI model is here, because the people who use Maschina bring their own keys.
 */
export type Logo = { name: string; file: string; gray?: string; w: number; h: number };

export const STACK_RUNS_ON: Logo[] = [
	{ name: "Solana", file: "solana", w: 175, h: 26 },
	{ name: "Jupiter", file: "jupiter", gray: "jupiter-gray", w: 85, h: 26 },
	{ name: "Helius", file: "helius", w: 133, h: 28 },
	{ name: "Turnkey", file: "turnkey", w: 100, h: 26 },
	{ name: "Cloudflare", file: "cloudflare", w: 97, h: 36 },
	{ name: "PostgreSQL", file: "postgresql", w: 38, h: 40 },
	{ name: "Better Auth", file: "betterauth", w: 88, h: 22 },
	{ name: "Sentry", file: "sentry", w: 36, h: 32 },
	{ name: "Docker", file: "docker", w: 32, h: 32 },
	{ name: "Node.js", file: "nodejs", w: 28, h: 32 },
	{ name: "PostHog", file: "posthog", w: 115, h: 22 },
];

export const STACK_WRITTEN_WITH: Logo[] = [
	{ name: "TypeScript", file: "typescript", w: 32, h: 32 },
	{ name: "React", file: "react", w: 73, h: 22 },
	{ name: "TanStack", file: "tanstack", w: 141, h: 22 },
	{ name: "Tailwind CSS", file: "tailwindcss", w: 175, h: 22 },
	{ name: "Vite", file: "vite", w: 33, h: 32 },
	{ name: "Hono", file: "hono", w: 25, h: 32 },
	{ name: "Drizzle ORM", file: "drizzle", w: 32, h: 32 },
	{ name: "Zod", file: "zod", w: 40, h: 32 },
	{ name: "three.js", file: "threejs", w: 32, h: 32 },
	{ name: "shadcn/ui", file: "shadcn", w: 32, h: 32 },
	{ name: "Radix UI", file: "radix", w: 22, h: 32 },
	{ name: "Turborepo", file: "turborepo", w: 163, h: 22 },
	{ name: "pnpm", file: "pnpm", w: 45, h: 32 },
	{ name: "Vitest", file: "vitest", w: 33, h: 32 },
	{ name: "Biome", file: "biome", w: 37, h: 32 },
];
