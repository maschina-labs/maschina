import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticlePage } from "./article.tsx";
import { BrandPage } from "./brand-page.tsx";
import { ContactPage } from "./contact-page.tsx";
import { contentFor } from "./i18n/content.ts";
import { LegalPage } from "./legal.tsx";
import { PapersPage } from "./papers-page.tsx";
import { SupportPage } from "./support-page.tsx";

const AUTH = "https://auth.maschina.dev";
const english = contentFor("en");

describe("every text page opens with a centered head", () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("{}", { status: 200 })),
	);
	const pages: [string, () => ReactElement][] = [
		["an article", () => <ArticlePage authUrl={AUTH} doc={english.articles["/about"] as never} />],
		["a legal page", () => <LegalPage authUrl={AUTH} doc={english.documents["/terms"] as never} />],
		["the support page", () => <SupportPage authUrl={AUTH} doc={english.support} />],
		["the papers page", () => <PapersPage authUrl={AUTH} doc={english.papers} />],
		["the brand page", () => <BrandPage authUrl={AUTH} doc={english.brand} />],
		["the contact page", () => <ContactPage authUrl={AUTH} />],
	];

	it.each(pages)("%s starts its framing below the hero", (_name, page) => {
		const { container } = render(page());
		expect(container.querySelector("main")).not.toHaveClass("document-frame");
		expect(container.querySelector("[data-sheet]")).toHaveClass("document-frame");
		expect(container.querySelector("[data-page-strip], [data-legal-strip]")).toBeInTheDocument();
	});

	it.each(pages)(
		"%s centers everything in its head, and leaves the sheet that rolls over it alone",
		(_name, page) => {
			const { container } = render(page());
			const inner = container.querySelector("[data-head-text]") as HTMLElement;
			expect(inner.className).toContain("text-center");
			expect(inner.className).toContain("mx-auto");
			// The part that rolls over the head is not part of this: it keeps its own alignment.
			const sheet = container.querySelector("[data-sheet]") as HTMLElement;
			expect(sheet.className).not.toContain("text-center");
		},
	);

	it.each(pages)(
		"%s has no small label above its headline: the headline is the first thing in the head",
		(_name, page) => {
			const { container } = render(page());
			const inner = container.querySelector("[data-head-text]") as HTMLElement;
			expect(inner.firstElementChild?.tagName).toBe("H1");
		},
	);

	it.each(pages)(
		"%s puts its head in the middle of the hero, not down at the bottom of it",
		(_name, page) => {
			const { container } = render(page());
			const head = container.querySelector("[data-head]") as HTMLElement;
			expect(head.className).toContain("justify-center");
			expect(head.className).not.toContain("justify-end");
		},
	);
});
