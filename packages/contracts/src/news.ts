/**
 * The news: headlines gathered from across Solana and crypto, for the News section. Only the headline,
 * a line or two, where it came from, and a link to read it there: the stories stay with their writers.
 */

import { z } from "zod";

export const NewsItem = z.strictObject({
	/** The story's own link, which is also what tells two copies of it apart. */
	id: z.string(),
	title: z.string(),
	link: z.url(),
	/** Who published it, by name: "Helius", "Decrypt". */
	source: z.string(),
	publishedAt: z.iso.datetime(),
	/** A line or two, as plain text, when the feed gives one. */
	summary: z.string().optional(),
	/** The story's picture, when the feed gives one. */
	image: z.url().optional(),
	/** About Solana, by where it came from or what it says. */
	solana: z.boolean(),
});
export type NewsItem = z.infer<typeof NewsItem>;

export const NewsResponse = z.strictObject({
	items: z.array(NewsItem),
	/** When the feeds were last read. */
	fetchedAt: z.iso.datetime(),
});
export type NewsResponse = z.infer<typeof NewsResponse>;
