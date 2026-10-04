/**
 * The news desk: headlines read from the public feeds of Solana and crypto publishers, merged, newest
 * first, and kept for a few minutes so every visitor shares one read of each feed.
 *
 * Only the headline, a line or two, a picture and the link go out: the stories are read on the
 * publisher's own site. A feed that is down is skipped; if every one is, the last good news stands.
 *
 * The feeds are RSS 2.0 and Atom, read with a small reader made for exactly the fields used here rather
 * than a general XML library: titles, links, dates, summaries and pictures.
 */

import type { NewsItem, NewsResponse } from "@maschina/contracts";
import type { Clock } from "@maschina/core";

export type Feed = {
	name: string;
	url: string;
	/** Everything it publishes is about Solana. */
	solana?: boolean;
};

const FEEDS: Feed[] = [
	{ name: "Solana Foundation", url: "https://solana.com/news/rss.xml", solana: true },
	{ name: "Helius", url: "https://www.helius.dev/blog/rss.xml", solana: true },
	{ name: "Cointelegraph", url: "https://cointelegraph.com/rss/tag/solana", solana: true },
	{ name: "Decrypt", url: "https://decrypt.co/feed" },
	{ name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
	{ name: "The Block", url: "https://www.theblock.co/rss.xml" },
	{ name: "Blockworks", url: "https://blockworks.co/feed" },
];

/** How long one read of the feeds serves everyone. */
const FRESH_MS = 5 * 60_000;
/** A feed slower than this is skipped for this read. */
const TIMEOUT_MS = 8_000;
const SUMMARY_MAX = 280;
/** The newest this many from each publisher, so the busiest ones do not crowd out the rest. */
const PER_FEED = 15;
// Named outright, so a story about Solana from a general publisher is found too.
const ABOUT_SOLANA = /\bsolana\b|\$?\bSOL\b/i;

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decode(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
		if (name[0] === "#") {
			const code =
				name[1]?.toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
			return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
		}
		return ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/** A field's text, out of its CDATA if it has one, with entities read. */
function field(block: string, tag: string): string | undefined {
	const found = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
	if (!found?.[1]) return undefined;
	const raw = found[1].trim();
	const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
	const text = cdata ? (cdata[1] ?? "") : decode(raw);
	return text.trim() || undefined;
}

/** An attribute on the first tag of a kind, such as an enclosure's url. */
function attribute(block: string, tag: string, name: string, where?: RegExp): string | undefined {
	for (const each of block.matchAll(new RegExp(`<${tag}\\s[^>]*>`, "gi"))) {
		if (where && !where.test(each[0])) continue;
		const value = each[0].match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];
		if (value) return decode(value);
	}
	return undefined;
}

/** HTML down to its words, for a summary. */
function plain(html: string): string {
	return decode(html.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function shorten(text: string): string {
	if (text.length <= SUMMARY_MAX) return text;
	const cut = text.slice(0, SUMMARY_MAX);
	return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : SUMMARY_MAX).trimEnd()}…`;
}

/** The link without the tracking a feed adds, which is also how two copies of a story are matched. */
function clean(link: string): string | undefined {
	try {
		const url = new URL(link);
		for (const key of [...url.searchParams.keys()])
			if (key.startsWith("utm_")) url.searchParams.delete(key);
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

const isUrl = (value: string | undefined) => (value && clean(value) ? value : undefined);

/** The stories in one feed, RSS or Atom. Anything without a link, a title or a date is left out. */
export function readFeed(xml: string, feed: Feed): NewsItem[] {
	const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
	const blocks = xml.match(
		atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi,
	);
	const items: NewsItem[] = [];
	for (const block of blocks ?? []) {
		const title = field(block, "title");
		const rawLink = atom
			? (attribute(block, "link", "href", /rel="alternate"/) ?? attribute(block, "link", "href"))
			: field(block, "link");
		const link = rawLink ? clean(rawLink) : undefined;
		const when = field(block, atom ? "published" : "pubDate") ?? field(block, "updated");
		const date = when ? new Date(when) : undefined;
		if (!title || !link || !date || Number.isNaN(date.getTime())) continue;

		const html = field(block, atom ? "summary" : "description") ?? "";
		const summary = html ? shorten(plain(html)) : "";
		const image = isUrl(
			attribute(block, "enclosure", "url", /type="image/) ??
				attribute(block, "media:content", "url") ??
				attribute(block, "media:thumbnail", "url") ??
				html.match(/<img\s[^>]*src="([^"]+)"/i)?.[1],
		);
		const titleText = plain(title);
		items.push({
			id: link,
			title: titleText,
			link,
			source: feed.name,
			publishedAt: date.toISOString(),
			...(summary ? { summary } : {}),
			...(image ? { image } : {}),
			solana: feed.solana === true || ABOUT_SOLANA.test(`${titleText} ${summary}`),
		});
	}
	return items;
}

export type NewsDesk = { latest(): Promise<NewsResponse> };

export function newsDesk(options: {
	feeds?: Feed[];
	fetch?: typeof fetch;
	clock: Clock;
	limit?: number;
}): NewsDesk {
	const feeds = options.feeds ?? FEEDS;
	const get = options.fetch ?? fetch;
	// Room for every publisher's newest, so none is cut for being a little older than the rest.
	const limit = options.limit ?? PER_FEED * feeds.length;
	let kept: { news: NewsResponse; at: number } | undefined;
	let reading: Promise<NewsResponse> | undefined;

	async function one(feed: Feed): Promise<NewsItem[]> {
		try {
			const response = await get(feed.url, {
				headers: {
					"user-agent": "Maschina/1.0 (+https://maschina.dev)",
					accept: "application/rss+xml, application/atom+xml, text/xml",
				},
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!response.ok) return [];
			return readFeed(await response.text(), feed)
				.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
				.slice(0, PER_FEED);
		} catch {
			return [];
		}
	}

	async function read(): Promise<NewsResponse> {
		const now = options.clock.now();
		const all = (await Promise.all(feeds.map(one))).flat();
		if (all.length === 0 && kept) {
			// Every feed failed: the last good news stands, and the feeds are tried again in a few minutes.
			kept = { news: kept.news, at: now.getTime() };
			return kept.news;
		}
		const seen = new Map<string, NewsItem>();
		for (const item of all) if (!seen.has(item.id)) seen.set(item.id, item);
		const items = [...seen.values()]
			.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
			.slice(0, limit);
		const news = { items, fetchedAt: now.toISOString() };
		kept = { news, at: now.getTime() };
		return news;
	}

	return {
		latest() {
			if (kept && options.clock.now().getTime() - kept.at < FRESH_MS)
				return Promise.resolve(kept.news);
			reading ??= read().finally(() => {
				reading = undefined;
			});
			return reading;
		},
	};
}
