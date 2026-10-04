import { ManualClock } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { type Feed, newsDesk, readFeed } from "./news.ts";

// Shaped after the real feeds: CDATA, entities, an enclosure, media:content, a picture in the HTML.
const RSS = `<?xml version="1.0"?><rss><channel><title>Decrypt</title>
<item>
	<title><![CDATA[Open USD Is Live on Solana]]></title>
	<link>https://solana.com/news/open-usd-is-live-on-solana</link>
	<pubDate>Wed, 30 Sep 2026 19:17:00 GMT</pubDate>
	<description><![CDATA[<p>A dollar that <b>settles</b> in seconds &amp; costs nothing.</p>]]></description>
	<enclosure length="0" type="image/webp" url="https://solana.com/uploads/hero.webp"/>
</item>
<item>
	<title>North Korea&#39;s haul passes $1 billion</title>
	<link>https://decrypt.co/380005/haul?utm_source=rss</link>
	<pubDate>Sat, 03 Oct 2026 17:01:03 +0000</pubDate>
	<description>The firm traced it across four chains.</description>
	<media:content url="https://cdn.example.com/korea.jpg?fm=jpg&amp;w=1920" medium="image"/>
</item>
<item>
	<title>ETF inflows cool</title>
	<link><![CDATA[https://cointelegraph.com/markets/etf?utm_source=rss_feed]]></link>
	<pubDate>Tue, 29 Sep 2026 10:15:19 +0000</pubDate>
	<description><![CDATA[<p><img src="https://s3.example.com/etf.png" alt="x"></p><p>Inflows fell.</p>]]></description>
</item>
<item><title>No link, so not a story</title><pubDate>Tue, 29 Sep 2026 10:15:19 +0000</pubDate></item>
<item><title>No date</title><link>https://example.com/nodate</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Helius Blog</title>
<entry>
	<title type="html"><![CDATA[Agave 4.3 Update: All You Need to Know]]></title>
	<id>https://www.helius.dev/blog/agave-v4-3</id>
	<link href="https://www.helius.dev/blog/agave-v4-3"/>
	<updated>2026-09-21T10:00:00.000Z</updated>
	<summary type="html"><![CDATA[Alpenglow replaces TowerBFT.]]></summary>
	<content type="html"><![CDATA[<h2>Long body</h2>]]></content>
</entry>
</feed>`;

const solana: Feed = { name: "Solana", url: "https://solana.com/news/rss.xml", solana: true };
const decrypt: Feed = { name: "Decrypt", url: "https://decrypt.co/feed" };

describe("reading a feed", () => {
	it("reads RSS: plain titles, links, dates, summaries and pictures, wherever the feed puts them", () => {
		const items = readFeed(RSS, decrypt);
		expect(items.map((each) => each.title)).toEqual([
			"Open USD Is Live on Solana",
			"North Korea's haul passes $1 billion",
			"ETF inflows cool",
		]);
		const [open, korea, etf] = items;
		expect(open?.summary).toBe("A dollar that settles in seconds & costs nothing.");
		expect(open?.image).toBe("https://solana.com/uploads/hero.webp");
		expect(open?.publishedAt).toBe("2026-09-30T19:17:00.000Z");
		expect(korea?.image).toBe("https://cdn.example.com/korea.jpg?fm=jpg&w=1920");
		expect(etf?.image).toBe("https://s3.example.com/etf.png");
		expect(etf?.summary).toBe("Inflows fell.");
		expect(items.every((each) => each.source === "Decrypt")).toBe(true);
	});

	it("leaves the tracking off a link, so the same story from two feeds is one", () => {
		const [, korea, etf] = readFeed(RSS, decrypt);
		expect(korea?.link).toBe("https://decrypt.co/380005/haul");
		expect(etf?.link).toBe("https://cointelegraph.com/markets/etf");
		expect(korea?.id).toBe(korea?.link);
	});

	it("reads Atom too, taking the summary rather than the whole article", () => {
		const [agave] = readFeed(ATOM, { name: "Helius", url: "https://www.helius.dev/blog/rss.xml" });
		expect(agave?.title).toBe("Agave 4.3 Update: All You Need to Know");
		expect(agave?.link).toBe("https://www.helius.dev/blog/agave-v4-3");
		expect(agave?.publishedAt).toBe("2026-09-21T10:00:00.000Z");
		expect(agave?.summary).toBe("Alpenglow replaces TowerBFT.");
	});

	it("marks a story about Solana by its feed, or by what it says", () => {
		expect(readFeed(RSS, solana).every((each) => each.solana)).toBe(true);
		const [open, korea] = readFeed(RSS, decrypt);
		expect(open?.solana).toBe(true);
		expect(korea?.solana).toBe(false);
	});

	it("keeps a long summary to a couple of lines", () => {
		const long = RSS.replace("The firm traced it across four chains.", "word ".repeat(200));
		const korea = readFeed(long, decrypt)[1];
		expect(korea?.summary?.length).toBeLessThanOrEqual(281);
		expect(korea?.summary?.endsWith("…")).toBe(true);
	});

	it("reads nothing from something that is not a feed", () => {
		expect(readFeed("<html>busy</html>", decrypt)).toEqual([]);
	});
});

function answers(pages: Record<string, string | Error>) {
	const asked: string[] = [];
	const fetcher = async (url: string | URL | Request) => {
		const key = String(url);
		asked.push(key);
		const page = pages[key];
		if (page instanceof Error) throw page;
		if (page === undefined) return new Response("gone", { status: 404 });
		return new Response(page, { status: 200 });
	};
	return { asked, fetcher: fetcher as typeof fetch };
}

describe("the news desk", () => {
	it("merges every feed, newest first, one copy of each story", async () => {
		const { fetcher } = answers({ [solana.url]: RSS, [decrypt.url]: RSS });
		const desk = newsDesk({ feeds: [solana, decrypt], fetch: fetcher, clock: new ManualClock() });
		const { items } = await desk.latest();
		expect(items.map((each) => each.title)).toEqual([
			"North Korea's haul passes $1 billion",
			"Open USD Is Live on Solana",
			"ETF inflows cool",
		]);
	});

	it("goes on without a feed that is down", async () => {
		const { fetcher } = answers({ [solana.url]: new Error("refused") });
		const desk = newsDesk({
			feeds: [solana, decrypt, { name: "Gone", url: "https://gone.example.com" }],
			fetch: fetcher,
			clock: new ManualClock(),
		});
		await expect(desk.latest()).resolves.toMatchObject({ items: [] });
		const { fetcher: some } = answers({ [decrypt.url]: RSS, [solana.url]: new Error("refused") });
		const partly = newsDesk({ feeds: [solana, decrypt], fetch: some, clock: new ManualClock() });
		expect((await partly.latest()).items).toHaveLength(3);
	});

	it("reads the feeds once for everyone, again only once the news is a few minutes old", async () => {
		const clock = new ManualClock("2026-10-03T12:00:00.000Z");
		const { asked, fetcher } = answers({ [decrypt.url]: RSS });
		const desk = newsDesk({ feeds: [decrypt], fetch: fetcher, clock });
		const [first, second] = await Promise.all([desk.latest(), desk.latest()]);
		expect(asked).toHaveLength(1);
		expect(second).toBe(first);
		expect(first.fetchedAt).toBe("2026-10-03T12:00:00.000Z");
		clock.advance(4 * 60_000);
		await desk.latest();
		expect(asked).toHaveLength(1);
		clock.advance(2 * 60_000);
		await desk.latest();
		expect(asked).toHaveLength(2);
	});

	it("keeps the last good news when every feed fails on a later read", async () => {
		const clock = new ManualClock();
		const pages: Record<string, string | Error> = { [decrypt.url]: RSS };
		const { fetcher } = answers(pages);
		const desk = newsDesk({ feeds: [decrypt], fetch: fetcher, clock });
		const before = await desk.latest();
		pages[decrypt.url] = new Error("down");
		clock.advance(10 * 60_000);
		expect((await desk.latest()).items).toEqual(before.items);
	});

	it("gives every publisher a place, however often the busiest one posts", async () => {
		const busy = RSS.replace(
			"</channel>",
			`${Array.from(
				{ length: 40 },
				(_, index) =>
					`<item><title>Busy ${index}</title><link>https://busy.example.com/${index}</link><pubDate>Sat, 03 Oct 2026 10:00:00 GMT</pubDate></item>`,
			).join("")}</channel>`,
		);
		const helius = { name: "Helius", url: "https://www.helius.dev/blog/rss.xml" };
		const { fetcher } = answers({ [decrypt.url]: busy, [helius.url]: ATOM });
		const desk = newsDesk({
			feeds: [decrypt, helius],
			fetch: fetcher,
			clock: new ManualClock(),
			limit: 20,
		});
		const { items } = await desk.latest();
		expect(items.filter((each) => each.source === "Decrypt").length).toBeLessThanOrEqual(15);
		expect(items.some((each) => each.source === "Helius")).toBe(true);
	});

	it("shows only so many stories", async () => {
		const many = RSS.replace(
			"</channel>",
			`${Array.from(
				{ length: 30 },
				(_, index) =>
					`<item><title>Story ${index}</title><link>https://example.com/${index}</link><pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate></item>`,
			).join("")}</channel>`,
		);
		const { fetcher } = answers({ [decrypt.url]: many });
		const desk = newsDesk({
			feeds: [decrypt],
			fetch: fetcher,
			clock: new ManualClock(),
			limit: 10,
		});
		expect((await desk.latest()).items).toHaveLength(10);
	});
});
