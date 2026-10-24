import type { ComponentType } from "react";

type MdxContent = ComponentType<{ components?: Record<string, unknown> }>;
const content = import.meta.glob<{ default: MdxContent }>("./*.mdx", { eager: true });

export const headingId = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "");

const HEADINGS: Record<string, string[]> = {
	examples: ["Read the public record", "Decision function", "Next steps"],
	sdk: [
		"Work from source",
		"Define a machine kind",
		"Return a proposal",
		"Authority and integration",
	],
	index: ["Get started", "Build with Maschina", "Understand the boundaries"],
	templates: [
		"Fixed range",
		"Following range",
		"Price trigger",
		"Recurring buy",
		"Choose and validate",
	],
	api: [
		"Schema and conventions",
		"Public reads",
		"Authentication",
		"Machine routes",
		"Errors and retries",
	],
	"machine-spec": [
		"Identity and configuration",
		"Lifecycle",
		"Decision and execution",
		"Budget and result",
		"Paper and live records",
	],
	quickstart: [
		"What you need",
		"1. Sign in",
		"2. Make a machine",
		"3. Start it, and watch",
		"What the limits actually do",
		"Where the record is",
		"What is not here yet",
	],
};

export const DOC_PAGES = [
	{ slug: "index", name: "Docs", group: "Start here" },
	{ slug: "quickstart", name: "Quickstart", group: "Start here" },
	{ slug: "machine-spec", name: "Machine Spec", group: "Concepts" },
	{ slug: "templates", name: "Templates", group: "Concepts" },
	{ slug: "api", name: "API", group: "Build" },
	{ slug: "sdk", name: "SDK", group: "Build" },
	{ slug: "examples", name: "Examples", group: "Build" },
].map((page) => {
	const Content = content[`./${page.slug}.mdx`]?.default;
	if (!Content) throw new Error(`Missing documentation: ${page.slug}`);
	return {
		...page,
		path: page.slug === "index" ? "/docs" : `/docs/${page.slug}`,
		Content,
		headings: (HEADINGS[page.slug] ?? []).map((title) => ({ title, id: headingId(title) })),
	};
});

export type DocPage = (typeof DOC_PAGES)[number];
