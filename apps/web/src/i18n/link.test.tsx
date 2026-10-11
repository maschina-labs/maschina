import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Link } from "./link.tsx";
import { LocaleContext } from "./locale-context.tsx";

const inLanguage = (code: "en" | "es" | "zh-tw", node: React.ReactNode) =>
	render(<LocaleContext.Provider value={code}>{node}</LocaleContext.Provider>);

describe("a link inside the site", () => {
	it("keeps the language of the page it is on: a page link in Spanish goes to the page in Spanish", () => {
		inLanguage("es", <Link href="/terms">Terms</Link>);
		expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/es/terms");
	});

	it("goes to the front page in the same language, and to a fragment of the page in it", () => {
		inLanguage(
			"zh-tw",
			<>
				<Link href="/">Home</Link>
				<Link href="/risk#loss">Loss</Link>
			</>,
		);
		expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/zh-tw");
		expect(screen.getByRole("link", { name: "Loss" })).toHaveAttribute("href", "/zh-tw/risk#loss");
	});

	it("leaves English addresses plain", () => {
		inLanguage("en", <Link href="/terms">Terms</Link>);
		expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
	});

	it("never changes a link that is not a page of the site: another site, mail, and the plain files", () => {
		inLanguage(
			"es",
			<>
				<Link href="https://github.com/maschina-labs">org</Link>
				<Link href="mailto:legal@maschina.dev">mail</Link>
				<Link href="/llms.txt">index</Link>
				<Link href="/brand/maschina-brand-kit.zip">pack</Link>
			</>,
		);
		expect(screen.getByRole("link", { name: "org" })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs",
		);
		expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute(
			"href",
			"mailto:legal@maschina.dev",
		);
		expect(screen.getByRole("link", { name: "index" })).toHaveAttribute("href", "/llms.txt");
		expect(screen.getByRole("link", { name: "pack" })).toHaveAttribute(
			"href",
			"/brand/maschina-brand-kit.zip",
		);
	});

	it("passes everything else through to the link: classes, download, target", () => {
		inLanguage(
			"es",
			<Link href="/x" className="a" target="_blank" rel="noopener" download>
				x
			</Link>,
		);
		const link = screen.getByRole("link", { name: "x" });
		expect(link).toHaveClass("a");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("download");
	});
});
