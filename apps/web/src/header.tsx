import { useEffect, useState } from "react";

/**
 * The header's pages, in order. The ones with a dropdown (Product, Developers, Company) carry a caret; Live
 * record and Pricing are single pages. The dropdowns themselves come next.
 */
const PAGES = [
	{ label: "Product", href: "/product", dropdown: true },
	{ label: "Developers", href: "/developers", dropdown: true },
	{ label: "Live record", href: "/live", dropdown: false },
	{ label: "Company", href: "/company", dropdown: true },
	{ label: "Pricing", href: "/pricing", dropdown: false },
];

/** How far the page has to scroll before the header takes its background. */
const SCROLLED_AT = 8;

const LINK =
	"text-[14px] text-[oklch(0.74_0.012_285)] transition-colors hover:text-[oklch(0.96_0.018_300)]";

/**
 * The top of the page: the wordmark on the left, the pages in the middle, the way in on the right. It is
 * attached to the top edge and sticky: it stays on screen as the page scrolls, and takes a solid black
 * background once it does, so nothing passes through the links. Every box is square, like the rest of Maschina.
 * On a phone the pages fold into a menu. The sign in and sign up pages live on auth.maschina.dev, so where
 * auth is comes in from outside.
 */
export function Header({ authUrl }: { authUrl: string }) {
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(
		() => typeof window !== "undefined" && window.scrollY > SCROLLED_AT,
	);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > SCROLLED_AT);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);
	const signIn = `${authUrl}/sign-in`;
	const signUp = `${authUrl}/sign-up`;

	return (
		<header
			className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${scrolled ? "bg-black" : "bg-transparent"}`}
		>
			<div className="grid grid-cols-[1fr_auto_1fr] items-center px-(--gutter) py-6">
				<a href="/" aria-label="Maschina, home" className="justify-self-start">
					<img src="/brand/wordmark.svg" alt="Maschina" className="h-4 w-auto sm:h-5" />
				</a>
				<nav aria-label="Pages" className="hidden items-center gap-7 lg:flex">
					{PAGES.map((page) => (
						<a
							key={page.label}
							href={page.href}
							className={`${LINK} inline-flex items-center gap-1.5`}
						>
							{page.label}
							{page.dropdown ? (
								<svg
									viewBox="0 0 12 12"
									className="size-2.5"
									fill="none"
									stroke="currentColor"
									strokeWidth={1.5}
									strokeLinecap="square"
									aria-hidden="true"
								>
									<path d="M2.5 4.5 6 8l3.5-3.5" />
								</svg>
							) : null}
						</a>
					))}
				</nav>
				<div className="col-start-3 flex items-center gap-3 justify-self-end text-[14px]">
					<a
						href={signIn}
						className="hidden bg-white/[0.13] px-4 py-2 text-neutral-200 transition-colors hover:bg-white/[0.18] lg:inline-block"
					>
						Sign in
					</a>
					<a
						href={signUp}
						className="hidden bg-[oklch(0.93_0.02_300)] px-4 py-2 text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] lg:inline-block"
					>
						Sign up
					</a>
					{/* On a phone: just a hamburger, in a square box of its own. It turns into a cross when open. */}
					<button
						type="button"
						aria-label="Menu"
						aria-expanded={open}
						aria-controls="pages-menu"
						onClick={() => setOpen((now) => !now)}
						className="grid size-10 place-items-center bg-white/[0.13] text-neutral-200 transition-colors hover:bg-white/[0.18] lg:hidden"
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
			{open ? (
				<nav
					id="pages-menu"
					aria-label="Pages, menu"
					className="mx-(--gutter) flex flex-col gap-1 bg-[oklch(0.19_0.006_285)] p-2 lg:hidden"
				>
					{PAGES.map((page) => (
						<a key={page.label} href={page.href} className={`${LINK} px-3 py-3`}>
							{page.label}
						</a>
					))}
					<div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
						<a
							href={signIn}
							className="bg-white/[0.13] px-4 py-3 text-center text-neutral-200 transition-colors hover:bg-white/[0.18]"
						>
							Sign in
						</a>
						<a
							href={signUp}
							className="bg-[oklch(0.93_0.02_300)] px-4 py-3 text-center text-black transition-colors hover:bg-[oklch(0.98_0.015_300)]"
						>
							Sign up
						</a>
					</div>
				</nav>
			) : null}
		</header>
	);
}
