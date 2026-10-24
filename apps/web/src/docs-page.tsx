import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import { DOC_PAGES, type DocPage, headingId } from "./docs/catalog.ts";
import { Link } from "./i18n/link.tsx";
import { useLocale } from "./i18n/locale-context.tsx";
import { label } from "./i18n/messages.ts";
import { useMessages } from "./i18n/use-messages.ts";
import { LanguageSwitcher } from "./language-switcher.tsx";
import { Logo } from "./logo.tsx";
import { useTitle } from "./use-title.ts";
import "./docs.css";

const plain = (children: ReactNode): string =>
	Array.isArray(children)
		? children.map(plain).join("")
		: typeof children === "string" || typeof children === "number"
			? String(children)
			: "";
const components = {
	a: (props: ComponentProps<"a">) => <Link {...props} />,
	h2: ({ children, ...props }: ComponentProps<"h2">) => (
		<h2 {...props} id={headingId(plain(children))} tabIndex={-1}>
			{children}
		</h2>
	),
};

/** A shared reading frame for every documentation route. */
export function DocsPage({ page }: { page: DocPage }) {
	const m = useMessages();
	const locale = useLocale();
	const [query, setQuery] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!menuOpen) return;
		const close = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setMenuOpen(false);
			menuButton.current?.focus();
		};
		document.addEventListener("keydown", close);
		return () => document.removeEventListener("keydown", close);
	}, [menuOpen]);
	const [light, setLight] = useState(() => {
		try {
			return localStorage.getItem("maschina_docs_theme") === "light";
		} catch {
			return false;
		}
	});
	useTitle(label(m, page.name));
	const words = query.trim().toLocaleLowerCase();
	const hits = DOC_PAGES.flatMap((doc) => [
		{ title: label(m, doc.name), href: doc.path },
		...doc.headings.map((heading) => ({ title: heading.title, href: `${doc.path}#${heading.id}` })),
	]).filter((hit) => hit.title.toLocaleLowerCase().includes(words));
	const Content = page.Content;
	return (
		<div className="docs-frame" data-theme={light ? "light" : "dark"}>
			<a className="docs-skip" href="#docs-content">
				Skip to content
			</a>
			<header className="docs-header">
				<div className="docs-brand">
					<Logo />
					<span>{label(m, "Docs")}</span>
				</div>
				<div className="docs-search">
					<input
						type="search"
						aria-label={m.header.search}
						placeholder={m.header.search}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") setQuery("");
						}}
					/>
					{words && (
						<nav className="docs-results" aria-label="Search results">
							{hits.length ? (
								hits.slice(0, 12).map((hit) => (
									<Link key={hit.href} href={hit.href} onClick={() => setQuery("")}>
										{hit.title}
									</Link>
								))
							) : (
								<p>{m.header.noMatch}</p>
							)}
						</nav>
					)}
				</div>
				<div className="docs-tools">
					<button
						type="button"
						aria-label="Light theme"
						aria-pressed={light}
						onClick={() => {
							const next = !light;
							setLight(next);
							try {
								localStorage.setItem("maschina_docs_theme", next ? "light" : "dark");
							} catch {
								/* The toggle still works without browser storage. */
							}
						}}
					>
						{light ? "◐" : "◑"}
					</button>
					<LanguageSwitcher placement="below" />
				</div>
			</header>
			<button
				ref={menuButton}
				className="docs-menu-button"
				type="button"
				aria-expanded={menuOpen}
				aria-controls="docs-sidebar"
				onClick={() => setMenuOpen((open) => !open)}
			>
				{menuOpen ? "Close navigation" : "Browse documentation"}
			</button>
			<div className="docs-layout">
				<aside id="docs-sidebar" className={`docs-sidebar ${menuOpen ? "is-open" : ""}`}>
					<nav aria-label={label(m, "Docs")}>
						{["Start here", "Concepts", "Build"].map((group) => (
							<div className="docs-nav-group" key={group}>
								<p>{group}</p>
								{DOC_PAGES.filter((doc) => doc.group === group).map((doc) => (
									<Link
										key={doc.path}
										href={doc.path}
										aria-current={page.path === doc.path ? "page" : undefined}
									>
										{label(m, doc.name)}
									</Link>
								))}
							</div>
						))}
					</nav>
					<div className="docs-sidebar-bottom">
						<Link href="/support">{label(m, "Support")}</Link>
						<a href="https://github.com/maschina-labs/maschina">{label(m, "GitHub")}</a>
					</div>
				</aside>
				<main id="docs-content" tabIndex={-1}>
					<article className="docs-article" lang="en">
						<p className="docs-kicker">{label(m, page.name)}</p>
						{locale !== "en" && (
							<p className="docs-language-note">This page is currently available in English.</p>
						)}
						<Content components={components} />
						<footer className="docs-page-footer">
							<a href="https://github.com/maschina-labs/maschina/issues/new/choose">
								Report an issue
							</a>
							<Link href="/support">{label(m, "Support")}</Link>
						</footer>
					</article>
				</main>
				<aside className="docs-toc">
					<nav aria-label="On this page">
						<p>On this page</p>
						{page.headings.map((section) => (
							<a key={section.id} href={`#${section.id}`}>
								{section.title}
							</a>
						))}
					</nav>
				</aside>
			</div>
		</div>
	);
}
