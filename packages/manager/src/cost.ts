/**
 * What a conversation cost the owner, in dollars, so they always know where their credit went.
 *
 * Prices per million tokens, as Anthropic lists them. Reading from the cache costs a tenth of fresh input
 * and writing to it a quarter more, which is why the prompt and tools are cached.
 */

import type { Usage } from "./claude.ts";

type Price = { input: number; output: number };

const PRICES: Record<string, Price> = {
	"claude-sonnet-5": { input: 3, output: 15 },
	"claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/** A model not listed is priced as the dearest one, so a cost is never shown lower than it was. */
const FALLBACK: Price = { input: 15, output: 75 };

export function costOf(model: string, usage: Usage): number {
	const price = PRICES[model] ?? FALLBACK;
	const dollars =
		(usage.inputTokens * price.input +
			usage.cacheReadTokens * price.input * 0.1 +
			usage.cacheWriteTokens * price.input * 1.25 +
			usage.outputTokens * price.output) /
		1_000_000;
	return Math.round(dollars * 1_000_000) / 1_000_000;
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
	inputTokens: a.inputTokens + b.inputTokens,
	outputTokens: a.outputTokens + b.outputTokens,
	cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
	cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
});

export const NO_USAGE: Usage = {
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
};
