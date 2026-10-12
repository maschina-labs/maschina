import type { ArticleDoc } from "../article.tsx";
import type { BrandDoc } from "../company/brand.ts";
import type { PapersDoc } from "../company/papers.ts";
import type { SupportDoc } from "../company/support.ts";
import type { LegalDoc } from "../legal.tsx";

/**
 * Walks the words of a page in a fixed order and says each one through a function. The same walk collects the words of
 * the English page (say returns what it is given), and builds a page in another language (say returns the next
 * translated word). Because one walk does both, a translation is a plain list of strings in this order, and an address,
 * a file or an id is never among them, so a translation cannot change where a link goes or which file is offered.
 */
export type Say = (text: string) => string;

/** Every string in a catalog, in the order it is written. Keys are never touched. */
export function mapStrings<T>(value: T, say: Say): T {
	if (typeof value === "string") return say(value) as T;
	if (Array.isArray(value)) return value.map((item) => mapStrings(item, say)) as T;
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, mapStrings(item, say)]),
		) as T;
	return value;
}

type Part = string | { text: string; href: string };
type Block = string | Part[] | { list: string[] } | { quote: string };

const parts = (list: Part[], say: Say): Part[] =>
	list.map((part) => (typeof part === "string" ? say(part) : { ...part, text: say(part.text) }));

function block(item: Block, say: Say): Block {
	if (typeof item === "string") return say(item);
	if (Array.isArray(item)) return parts(item, say);
	if ("list" in item) return { list: item.list.map(say) };
	return { quote: say(item.quote) };
}

export function mapLegal(doc: LegalDoc, say: Say): LegalDoc {
	const title = say(doc.title);
	const updated = say(doc.updated);
	const intro = doc.intro?.map((item) => (typeof item === "string" ? say(item) : parts(item, say)));
	const sections = doc.sections.map((section) => ({
		heading: say(section.heading),
		body: section.body.map((item) => block(item, say)),
	}));
	return { ...doc, title, updated, ...(intro ? { intro } : {}), sections } as LegalDoc;
}

export function mapArticleDoc(doc: ArticleDoc, say: Say): ArticleDoc {
	const kicker = say(doc.kicker);
	const title = say(doc.title);
	const standfirst = say(doc.standfirst);
	const byline = say(doc.byline);
	const date = say(doc.date);
	const sections = doc.sections.map((section) => ({
		...(section.heading ? { heading: say(section.heading) } : {}),
		body: section.body.map((item) => block(item, say)),
	}));
	return { kicker, title, standfirst, byline, date, sections } as ArticleDoc;
}

export function mapSupport(doc: SupportDoc, say: Say): SupportDoc {
	const kicker = say(doc.kicker);
	const title = say(doc.title);
	const standfirst = say(doc.standfirst);
	const ways = doc.ways.map((way) => ({
		title: say(way.title),
		body: say(way.body),
		href: way.href,
	}));
	const articles = { heading: say(doc.articles.heading), body: say(doc.articles.body) };
	// The help center's words come last, so every sentence before them keeps its place in each translation.
	const center = {
		search: say(doc.center.search),
		none: say(doc.center.none),
		topics: doc.center.topics.map((topic) => ({
			title: say(topic.title),
			body: say(topic.body),
			pages: topic.pages,
		})),
		moreWays: say(doc.center.moreWays),
	};
	return { kicker, title, standfirst, ways, articles, center };
}

export function mapPapers(doc: PapersDoc, say: Say): PapersDoc {
	const kicker = say(doc.kicker);
	const title = say(doc.title);
	const standfirst = say(doc.standfirst);
	const groups = doc.groups.map((group) => ({
		...group,
		heading: say(group.heading),
		items: group.items.map((item) => ({
			...item,
			name: say(item.name),
			...(item.body ? { body: say(item.body) } : {}),
		})),
	}));
	return { kicker, title, standfirst, groups, ...(doc.pack ? { pack: doc.pack } : {}) };
}

export function mapBrand(doc: BrandDoc, say: Say): BrandDoc {
	const title = say(doc.title);
	const standfirst = say(doc.standfirst);
	const logos = {
		heading: say(doc.logos.heading),
		body: say(doc.logos.body),
		items: doc.logos.items.map((item) => ({ ...item, label: say(item.label) })),
	};
	const colors = {
		heading: say(doc.colors.heading),
		body: say(doc.colors.body),
		items: doc.colors.items.map((item) => ({ ...item, name: say(item.name) })),
	};
	const clearspace = { heading: say(doc.clearspace.heading), body: say(doc.clearspace.body) };
	const typeface = { heading: say(doc.typeface.heading), body: say(doc.typeface.body) };
	const rules = {
		heading: say(doc.rules.heading),
		body: say(doc.rules.body),
		dont: doc.rules.dont.map(say),
	};
	return { ...doc, title, standfirst, logos, colors, clearspace, typeface, rules };
}
