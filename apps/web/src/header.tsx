import { useEffect, useRef, useState } from "react";
import { MENUS } from "./menus.ts";

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
const SCROLLED_AT = 8;

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

/** Only languages the site is written in are offered. English, until a translation is real. */
const LANGUAGES = [{ code: "en", name: "English" }];

/** A square box showing the language as its short code, with a globe and a caret. */
function Language() {
	return (
		<label className="relative flex items-center gap-2 bg-white/[0.13] py-2 pr-8 pl-3 text-[14px] text-neutral-200 transition-colors hover:bg-white/[0.18]">
			<svg
				viewBox="0 0 24 24"
				className="size-[14px]"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
			</svg>
			<select
				aria-label="Language"
				defaultValue="en"
				className="cursor-pointer appearance-none bg-transparent outline-none"
			>
				{LANGUAGES.map((language) => (
					<option
						key={language.code}
						value={language.code}
						label={language.code.toUpperCase()}
						className="bg-black"
					>
						{language.name}
					</option>
				))}
			</select>
			<svg
				viewBox="0 0 24 24"
				className="pointer-events-none absolute right-3 size-[12px]"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</label>
	);
}

/**
 * The main call to action: the pearl button with a small square black chip inset beside the words, an arrow
 * pointing up and to the right in white. The chip is smaller than the button, so pearl shows all around it.
 * It is part of the link, so the whole thing is one click, and the arrow is decoration (the name stays
 * "Try Maschina").
 */
function TryButton({
	href,
	className,
	labelClassName,
	chipClassName,
}: {
	href: string;
	className: string;
	labelClassName: string;
	chipClassName: string;
}) {
	return (
		<a
			href={href}
			className={`items-center gap-3 bg-[oklch(0.93_0.02_300)] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] ${className}`}
		>
			<span className={labelClassName}>Try Maschina</span>
			<span data-chip className={`grid place-items-center bg-black text-white ${chipClassName}`}>
				<svg
					viewBox="0 0 12 12"
					className="size-3"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					strokeLinecap="square"
					aria-hidden="true"
				>
					<path d="M3 9l6-6M4 3h5v5" />
				</svg>
			</span>
		</a>
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
 * The top of the page: the wordmark on the left, the pages in the middle, the way in on the right. It is
 * attached to the top edge and sticky: it stays on screen as the page scrolls, and takes a solid black
 * background once it does, so nothing passes through the links. Every box is square, like the rest of Maschina.
 *
 * Product, Developers and Company open a full-width dropdown under the bar when the cursor rests on them,
 * and by click or Escape for keyboards and touch. The page dims behind it. On a phone the pages fold into a
 * menu. The sign in and sign up pages live on auth.maschina.dev, so where auth is comes in from outside.
 */
export function Header({ authUrl }: { authUrl: string }) {
	const [open, setOpen] = useState(false);
	const [section, setSection] = useState<string | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const [scrolled, setScrolled] = useState(
		() => typeof window !== "undefined" && window.scrollY > SCROLLED_AT,
	);
	const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > SCROLLED_AT);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => () => clearTimeout(closing.current), []);

	useEffect(() => {
		if (!active && !open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setActive(null);
			setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [active, open]);

	const stay = () => clearTimeout(closing.current);
	const show = (label: string) => {
		stay();
		setActive(label);
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
	const signIn = `${authUrl}/sign-in`;
	const signUp = `${authUrl}/sign-up`;

	return (
		<>
			{menu || open ? (
				<div
					data-backdrop
					aria-hidden="true"
					onClick={() => {
						hideNow();
						setOpen(false);
					}}
					className={`fixed inset-0 z-30 bg-black/60 ${menu ? "hidden xl:block" : "xl:hidden"}`}
				/>
			) : null}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover only keeps the dropdown open for a mouse; keyboards and touch use the buttons and Escape, which are tested */}
			<header
				onMouseEnter={stay}
				onMouseLeave={hideSoon}
				className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${scrolled || menu || open ? "bg-black" : "bg-transparent"}`}
			>
				<div className="grid grid-cols-[1fr_auto_1fr] items-center px-(--gutter) py-4">
					<a href="/" aria-label="Maschina, home" className="justify-self-start">
						<img src="/brand/wordmark.svg" alt="Maschina" className="h-4 w-auto sm:h-5" />
					</a>
					<nav aria-label="Pages" className="hidden items-center gap-7 xl:flex">
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
					<div className="col-start-3 flex items-center gap-3 justify-self-end text-[14px]">
						<div data-tools className="hidden items-center gap-2 xl:flex">
							<Language />
						</div>
						<a
							href={signIn}
							className="hidden bg-white/[0.13] px-4 py-2 text-neutral-200 transition-colors hover:bg-white/[0.18] xl:inline-block"
						>
							Log in
						</a>
						<TryButton
							href={signUp}
							className="hidden py-1.5 pr-1.5 pl-4 xl:inline-flex"
							labelClassName=""
							chipClassName="size-6"
						/>
						{/* On a phone: just a hamburger, in a square box of its own. It turns into a cross when open. */}
						<button
							type="button"
							aria-label="Menu"
							aria-expanded={open}
							aria-controls="pages-menu"
							onClick={() => setOpen((now) => !now)}
							className="grid size-10 place-items-center bg-white/[0.13] text-neutral-200 transition-colors hover:bg-white/[0.18] xl:hidden"
						>
							<svg
								viewBox="0 0 20 20"
								className="size-5"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinecap="square"
								aria-hidden="true"
							>
								{open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
							</svg>
						</button>
					</div>
				</div>
				{menu && active ? (
					<section
						aria-label={active}
						className="absolute inset-x-0 top-full hidden bg-black px-(--gutter) pt-6 pb-10 xl:block"
					>
						<div className="grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-x-20">
							<div className="flex flex-col gap-5">
								<p className="text-[13px] text-neutral-500">{menu.intro}</p>
								<ul className="flex flex-col gap-1.5">
									{menu.main.map((item) => (
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
								<p className="text-[13px] text-neutral-500">{menu.asideTitle}</p>
								<ul className="flex flex-col gap-3 pt-1">
									{menu.aside.map((item) => (
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
					</section>
				) : null}
				{open ? (
					<nav
						id="pages-menu"
						aria-label="Pages, menu"
						className="absolute inset-x-0 top-full flex max-h-[calc(100dvh-5.5rem)] flex-col gap-1 overflow-y-auto bg-black px-(--gutter) pt-2 pb-8 xl:hidden"
					>
						{PAGES.map((page) =>
							page.dropdown ? (
								<div key={page.label}>
									<button
										type="button"
										aria-expanded={section === page.label}
										onClick={() => setSection((now) => (now === page.label ? null : page.label))}
										className={`${ROW} flex w-full items-center justify-between`}
									>
										{page.label}
										<Caret open={section === page.label} />
									</button>
									{section === page.label && MENUS[page.label] ? (
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
									) : null}
								</div>
							) : (
								<a key={page.label} href={page.href} className={ROW}>
									{page.label}
								</a>
							),
						)}
						<div className="mt-4 flex items-center gap-2">
							<Language />
						</div>
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
							/>
						</div>
					</nav>
				) : null}
			</header>
		</>
	);
}
