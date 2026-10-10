import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo.tsx";
import { MENUS } from "./menus.ts";
import { usePresence } from "./presence.ts";
import { search } from "./search.ts";
import { TryButton } from "./try-button.tsx";

/**
 * The header's pages, in order. The three with a dropdown carry a caret and open a menu from menus.ts; Live
 * record and Pricing are single pages.
 */
const PAGES = [
	{ label: "Product", href: "/product", dropdown: true },
	{ label: "Developers", href: "/developers", dropdown: true },
	{ label: "Company", href: "/company", dropdown: true },
	{ label: "Live record", href: "/live", dropdown: false },
	{ label: "Pricing", href: "/pricing", dropdown: false },
];

/** How far the page has to scroll before the header takes its background. */
/** The bar's height when it cannot be measured: the fade is full once the page has scrolled this far. */
const BAR_HEIGHT = 90;

/** How long a panel takes to slide away, which is how long it stays on screen after it is closed. */
const EXIT_MS = 240;

/** How many pages the search lists at once. */
const MAX_HITS = 12;

/** Goes to a page. A function so a test can stand in for the browser's navigation. */
const go = (href: string) => window.location.assign(href);

/** How long a dropdown waits after the cursor leaves, so crossing a small gap does not close it. */
const CLOSE_DELAY_MS = 180;

const LINK =
	"text-[14px] text-[oklch(0.74_0.012_285)] transition-colors hover:text-[oklch(0.96_0.018_300)]";

/** A row in the phone menu, and the links that unfold under it. */
const ROW =
	"block py-3.5 font-display text-[1.375rem] leading-tight tracking-[-0.015em] text-[oklch(0.82_0.012_285)] transition-colors hover:text-[oklch(0.97_0.018_300)]";
const SUB =
	"block font-display text-[1.125rem] leading-tight text-[oklch(0.7_0.012_285)] transition-colors hover:text-[oklch(0.97_0.018_300)]";

const BIG =
	"font-display text-[clamp(1.25rem,1.9vw,1.875rem)] leading-[1.2] tracking-[-0.02em] text-[oklch(0.82_0.012_285)] transition-colors hover:text-[oklch(0.97_0.018_300)]";

function Magnifier() {
	return (
		<svg
			viewBox="0 0 20 20"
			className="size-4"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="square"
			aria-hidden="true"
		>
			<circle cx="8.5" cy="8.5" r="5.5" />
			<path d="M13 13l4 4" />
		</svg>
	);
}

function Caret({ open }: { open: boolean }) {
	return (
		<svg
			viewBox="0 0 12 12"
			className={`size-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="square"
			aria-hidden="true"
		>
			<path d="M2.5 4.5 6 8l3.5-3.5" />
		</svg>
	);
}

/**
 * The top of the page: the mark and the word on the left with the pages beside them, the way in on the
 * right. It is one attached bar, sticky: it stays on screen as the page scrolls, and takes a solid black
 * background once it does, so nothing passes through the links. Every box is square, like the rest of
 * Maschina.
 *
 * Product, Developers and Company open a full-width dropdown under the bar when the cursor rests on them,
 * and by click or Escape for keyboards and touch. The page dims behind it. On a phone the pages fold into a
 * menu. The sign in and sign up pages live on auth.maschina.dev, so where auth is comes in from outside.
 */
export function Header({
	authUrl,
	navigate = go,
}: {
	authUrl: string;
	navigate?: (href: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [section, setSection] = useState<string | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");
	const [highlight, setHighlight] = useState(0);
	const box = useRef<HTMLInputElement>(null);
	const bar = useRef<HTMLElement>(null);
	const fade = useRef<HTMLDivElement>(null);
	const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	// How much of the fade and the blur is on: none at the top of the page, building as the page scrolls, and
	// all of it once the page has scrolled the height of the bar. It sets one property on the layer, which the
	// layer's black and its blur both read, so scrolling never re-renders the page.
	useEffect(() => {
		const update = () => {
			const height = bar.current?.offsetHeight || BAR_HEIGHT;
			const amount = Math.min(1, Math.max(0, window.scrollY / height));
			fade.current?.style.setProperty("--fade", String(amount));
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	useEffect(() => () => clearTimeout(closing.current), []);

	useEffect(() => {
		if (!active && !open && !searching) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setActive(null);
			setOpen(false);
			setSearching(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [active, open, searching]);

	// Ctrl or Command K opens the search from anywhere, and closes it again.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			setActive(null);
			setOpen(false);
			setQuery("");
			setHighlight(0);
			setSearching((now) => !now);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (searching) box.current?.focus();
	}, [searching]);

	const stay = () => clearTimeout(closing.current);
	const show = (label: string) => {
		stay();
		setSearching(false);
		setActive(label);
	};
	const openSearch = () => {
		stay();
		setActive(null);
		setOpen(false);
		setQuery("");
		setHighlight(0);
		setSearching(true);
	};
	const hideSoon = () => {
		stay();
		closing.current = setTimeout(() => setActive(null), CLOSE_DELAY_MS);
	};
	const hideNow = () => {
		stay();
		setActive(null);
	};

	const menu = active ? MENUS[active] : undefined;

	// Every panel slides open and closed rather than blinking, so each stays on screen while it leaves. The
	// dropdown remembers which menu it last showed, so its words do not vanish as it slides away. With
	// reduced motion there is no exit to play, and everything is gone at once.
	const exit =
		typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? 0
			: EXIT_MS;
	const lastActive = useRef<string | null>(null);
	if (active) lastActive.current = active;
	const shownName = active ?? lastActive.current;
	const shownMenu = shownName ? MENUS[shownName] : undefined;
	const dropdown = usePresence(Boolean(menu), exit);
	const searchPanel = usePresence(searching, exit);
	const mobileMenu = usePresence(open, exit);
	const backdrop = usePresence(Boolean(menu) || open || searching, exit);
	const backdropFor = useRef("dropdown");
	if (menu) backdropFor.current = "dropdown";
	else if (searching) backdropFor.current = "search";
	else if (open) backdropFor.current = "menu";
	const anyPanel = dropdown.mounted || searchPanel.mounted || mobileMenu.mounted;
	// While any panel is open the page behind it does not scroll, so a swipe or a wheel moves the panel's own list
	// and never the page. The page's own setting is put back the moment the last panel closes, or the header goes.
	const locking = Boolean(menu) || open || searching;
	useEffect(() => {
		if (!locking) return;
		const root = document.documentElement;
		const before = root.style.overflow;
		root.style.overflow = "hidden";
		return () => {
			root.style.overflow = before;
		};
	}, [locking]);
	// Nothing is listed until something is typed.
	const typed = query.trim() !== "";
	const hits = typed ? search(query).slice(0, MAX_HITS) : [];
	const signIn = `${authUrl}/sign-in`;
	const signUp = `${authUrl}/sign-up`;

	return (
		<>
			{backdrop.mounted ? (
				<div
					data-backdrop
					data-state={backdrop.visible ? "open" : "closed"}
					aria-hidden="true"
					onClick={() => {
						hideNow();
						setOpen(false);
						setSearching(false);
					}}
					className={`fixed inset-0 z-30 bg-black/30 backdrop-blur-xl backdrop-saturate-150 max-xl:bg-black/70 max-xl:backdrop-blur-none max-xl:backdrop-saturate-100 transition-opacity duration-300 ease-out motion-reduce:transition-none ${backdrop.visible ? "opacity-100" : "opacity-0"} ${backdropFor.current === "dropdown" ? "hidden xl:block" : backdropFor.current === "menu" ? "xl:hidden" : ""} ${backdrop.closing ? "pointer-events-none" : ""}`}
				/>
			) : null}
			{/* A sticky rail of no height: it stays at the top as the page scrolls, and goes down with the page when it is pulled to refresh. */}
			<div data-rail className="sticky top-0 z-40 h-0">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: hover only keeps the dropdown open for a mouse; keyboards and touch use the buttons and Escape, which are tested */}
				<header
					ref={bar}
					onMouseEnter={stay}
					onMouseLeave={hideSoon}
					className="absolute inset-x-0 top-0"
				>
					{/*
					 * Behind the bar, two layers. As the page scrolls the bar comes in from clear to solid black, with
					 * a hard bottom edge. While a dropdown, the search or the phone menu
					 * is open it fills in solid, so the panel and the bar read as one piece.
					 */}
					<div
						ref={fade}
						data-fade
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10 [--fade:0] bg-black opacity-(--fade)"
					/>
					<div
						data-solid
						aria-hidden="true"
						className={`pointer-events-none absolute inset-0 -z-10 bg-black transition-opacity duration-200 motion-reduce:transition-none ${anyPanel ? "opacity-100" : "opacity-0"}`}
					/>
					<div className="flex items-center justify-between px-(--gutter) py-5 xl:py-4">
						<div className="flex items-center gap-10">
							<Logo />
							<div className="hidden items-center gap-5 xl:flex">
								<nav aria-label="Pages" className="flex items-center gap-7">
									{PAGES.map((page) =>
										page.dropdown ? (
											<button
												key={page.label}
												type="button"
												aria-expanded={active === page.label}
												onMouseEnter={() => show(page.label)}
												onClick={() => (active === page.label ? hideNow() : show(page.label))}
												className={`${LINK} inline-flex items-center gap-1.5`}
											>
												{page.label}
												<Caret open={active === page.label} />
											</button>
										) : (
											<a
												key={page.label}
												href={page.href}
												onMouseEnter={hideNow}
												className={`${LINK} inline-flex items-center`}
											>
												{page.label}
											</a>
										),
									)}
								</nav>
								<button
									type="button"
									aria-label="Search"
									aria-expanded={searching}
									onClick={() => (searching ? setSearching(false) : openSearch())}
									className="grid size-8 place-items-center text-[oklch(0.74_0.012_285)] transition-colors hover:text-[oklch(0.96_0.018_300)]"
								>
									<Magnifier />
								</button>
							</div>
						</div>
						<div className="flex items-center gap-2 text-[14px] xl:gap-3">
							<a
								href={signIn}
								className={`${LINK} inline-flex h-10 items-center px-3.5 max-xl:bg-[oklch(0.93_0.02_300)] max-xl:text-black max-xl:hover:bg-[oklch(0.98_0.015_300)] sm:px-5 xl:inline-block xl:h-auto xl:px-2 xl:py-2`}
							>
								Log in
							</a>
							<TryButton
								href={signUp}
								className="hidden py-1 pr-1 pl-4 xl:inline-flex"
								labelClassName=""
								chipClassName="size-6"
								glint
							/>
							{/* On a phone: just a hamburger, in a square box of its own. It turns into a cross when open. */}
							<button
								type="button"
								aria-label="Menu"
								aria-expanded={open}
								aria-controls="pages-menu"
								onClick={() => {
									setSearching(false);
									setOpen((now) => !now);
								}}
								className="grid size-10 place-items-center bg-white/[0.13] text-neutral-200 transition-colors hover:bg-white/[0.18] xl:hidden"
							>
								{/* Phosphor's List and X, regular weight, drawn from the library's own paths. */}
								<svg
									viewBox="0 0 256 256"
									className={`col-start-1 row-start-1 size-6 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-0" : "opacity-100"}`}
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
								</svg>
								<svg
									viewBox="0 0 256 256"
									className={`col-start-1 row-start-1 size-6 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
								</svg>
							</button>
						</div>
					</div>
					{dropdown.mounted && shownMenu && shownName ? (
						<div
							data-panel="dropdown"
							data-state={dropdown.visible ? "open" : "closed"}
							aria-hidden={dropdown.closing ? true : undefined}
							inert={dropdown.closing}
							className={`absolute inset-x-0 top-full hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none xl:grid ${dropdown.visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
						>
							<section aria-label={shownName} className="min-h-0 overflow-hidden bg-black">
								<div className="max-h-[calc(100svh-5.5rem)] overflow-y-auto overscroll-contain px-(--gutter) pt-6 pb-10">
									<div className="grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-x-20">
										<div className="flex flex-col gap-5">
											<p className="text-[13px] text-neutral-500">{shownMenu.intro}</p>
											<ul className="flex flex-col gap-1.5">
												{shownMenu.main.map((item) => (
													<li key={item.label}>
														{item.href ? (
															<a href={item.href} className={BIG}>
																{item.label}
															</a>
														) : (
															<span
																aria-disabled="true"
																className={`${BIG} cursor-default opacity-40 hover:text-[oklch(0.82_0.012_285)]`}
															>
																{item.label}
																<span className="ml-2.5 align-middle font-sans text-[11px] tracking-normal text-neutral-400">
																	Soon
																</span>
															</span>
														)}
													</li>
												))}
											</ul>
										</div>
										<div className="flex flex-col gap-5">
											<p className="text-[13px] text-neutral-500">{shownMenu.asideTitle}</p>
											<ul className="flex flex-col gap-3 pt-1">
												{shownMenu.aside.map((item) => (
													<li key={item.label}>
														<a
															href={item.href}
															className="text-[14px] text-[oklch(0.82_0.012_285)] transition-colors hover:text-[oklch(0.97_0.018_300)]"
														>
															{item.label}
														</a>
													</li>
												))}
											</ul>
										</div>
									</div>
								</div>
							</section>
						</div>
					) : null}
					{searchPanel.mounted ? (
						<div
							data-panel="search"
							data-state={searchPanel.visible ? "open" : "closed"}
							aria-hidden={searchPanel.closing ? true : undefined}
							inert={searchPanel.closing}
							className={`absolute inset-x-0 top-full grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${searchPanel.visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
						>
							<section aria-label="Search" className="min-h-0 overflow-hidden bg-black">
								<div className="max-h-[calc(100svh-5.5rem)] overflow-y-auto overscroll-contain px-(--gutter) pt-4 pb-10">
									<input
										ref={box}
										type="search"
										aria-label="Search Maschina"
										placeholder="Search Maschina"
										value={query}
										onChange={(event) => {
											setQuery(event.target.value);
											setHighlight(0);
										}}
										onKeyDown={(event) => {
											if (event.key === "ArrowDown") {
												event.preventDefault();
												setHighlight((now) => Math.min(hits.length - 1, now + 1));
											} else if (event.key === "ArrowUp") {
												event.preventDefault();
												setHighlight((now) => Math.max(0, now - 1));
											} else if (event.key === "Enter") {
												const hit = hits[highlight];
												if (hit) navigate(hit.href);
											}
										}}
										className="w-full bg-transparent pb-5 font-display text-[clamp(1.25rem,1.9vw,1.875rem)] text-[oklch(0.9_0.012_285)] tracking-[-0.02em] outline-none placeholder:text-neutral-600"
									/>
									{hits.length ? (
										<ul className="flex flex-col">
											{hits.map((hit, index) => (
												<li key={hit.href}>
													<a
														href={hit.href}
														data-active={index === highlight}
														className={`flex items-baseline justify-between gap-6 px-3 py-2.5 text-[16px] transition-colors ${index === highlight ? "bg-white/[0.08] text-[oklch(0.97_0.018_300)]" : "text-[oklch(0.78_0.012_285)] hover:bg-white/[0.05]"}`}
													>
														<span>{hit.label}</span>
														<span className="text-[13px] text-neutral-500">{hit.section}</span>
													</a>
												</li>
											))}
										</ul>
									) : typed ? (
										<p className="px-3 py-2.5 text-[16px] text-neutral-500">No pages match.</p>
									) : null}
								</div>
							</section>
						</div>
					) : null}
					{mobileMenu.mounted ? (
						<div
							data-panel="menu"
							data-state={mobileMenu.visible ? "open" : "closed"}
							aria-hidden={mobileMenu.closing ? true : undefined}
							inert={mobileMenu.closing}
							className={`absolute inset-x-0 top-full will-change-[clip-path] transition-[clip-path] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none xl:hidden ${mobileMenu.visible ? "[clip-path:inset(0_0_0_0)]" : "[clip-path:inset(0_0_100%_0)]"}`}
						>
							<div className="bg-black">
								<nav
									id="pages-menu"
									aria-label="Pages, menu"
									className="flex max-h-[calc(100svh-5.5rem)] flex-col gap-1 overflow-y-auto overscroll-contain px-(--gutter) pt-2 pb-8"
								>
									{/* The search is the first thing in the phone menu: a full width bar, like a field, above the pages. */}
									<button
										type="button"
										aria-label="Search"
										onClick={openSearch}
										className="mb-3 flex h-12 w-full items-center gap-3 bg-white/[0.08] px-4 text-[16px] text-neutral-400 transition-colors hover:bg-white/[0.12]"
									>
										<Magnifier />
										Search Maschina
									</button>
									{PAGES.map((page) =>
										page.dropdown ? (
											<div key={page.label}>
												<button
													type="button"
													aria-expanded={section === page.label}
													onClick={() =>
														setSection((now) => (now === page.label ? null : page.label))
													}
													className={`${ROW} flex w-full items-center justify-between`}
												>
													{page.label}
													<Caret open={section === page.label} />
												</button>
												{MENUS[page.label] ? (
													<div
														data-panel="section"
														data-state={section === page.label ? "open" : "closed"}
														aria-hidden={section === page.label ? undefined : true}
														inert={section !== page.label}
														className={`grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${section === page.label ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
													>
														<div className="min-h-0 overflow-hidden">
															<div className="flex flex-col gap-5 pb-4 pl-1">
																<ul className="flex flex-col gap-3">
																	{MENUS[page.label]?.main.map((item) => (
																		<li key={item.label}>
																			{item.href ? (
																				<a href={item.href} className={SUB}>
																					{item.label}
																				</a>
																			) : (
																				<span
																					aria-disabled="true"
																					className={`${SUB} cursor-default opacity-40`}
																				>
																					{item.label}
																					<span className="ml-2.5 align-middle font-sans text-[11px] text-neutral-400">
																						Soon
																					</span>
																				</span>
																			)}
																		</li>
																	))}
																</ul>
																<ul className="flex flex-col gap-2.5">
																	{MENUS[page.label]?.aside.map((item) => (
																		<li key={item.label}>
																			<a
																				href={item.href}
																				className="text-[14px] text-neutral-500 transition-colors hover:text-neutral-200"
																			>
																				{item.label}
																			</a>
																		</li>
																	))}
																</ul>
															</div>
														</div>
													</div>
												) : null}
											</div>
										) : (
											<a key={page.label} href={page.href} className={ROW}>
												{page.label}
											</a>
										),
									)}
									<div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
										<a
											href={signIn}
											className="bg-white/[0.13] px-4 py-3 text-center text-neutral-200 transition-colors hover:bg-white/[0.18]"
										>
											Log in
										</a>
										<TryButton
											href={signUp}
											className="flex py-2 pr-2 pl-4"
											labelClassName="flex-1 text-center"
											chipClassName="size-8"
											glint
										/>
									</div>
								</nav>
							</div>
						</div>
					) : null}
				</header>
			</div>
		</>
	);
}
