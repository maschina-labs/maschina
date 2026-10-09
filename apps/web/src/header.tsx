import { useEffect, useState } from "react";

/** The pages a stranger needs to understand and trust Maschina. The rest belong in the footer. */
const PAGES = [
	{ label: "Machines", href: "/machines" },
	{ label: "Security", href: "/security" },
	{ label: "Live record", href: "/live" },
	{ label: "Developers", href: "/developers" },
	{ label: "Pricing", href: "/pricing" },
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
						<a key={page.label} href={page.href} className={LINK}>
							{page.label}
						</a>
					))}
				</nav>
				<div className="col-start-3 flex items-center gap-2 justify-self-end text-[13px] sm:gap-3 sm:text-[14px]">
					<a
						href={signIn}
						className="hidden bg-white/[0.13] px-4 py-2 text-neutral-200 transition-colors hover:bg-white/[0.18] sm:inline-block"
					>
						Sign in
					</a>
					<a
						href={`${authUrl}/sign-up`}
						className="bg-[oklch(0.93_0.02_300)] px-3 py-2 text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] sm:px-4"
					>
						Sign up
					</a>
					<button
						type="button"
						aria-expanded={open}
						aria-controls="pages-menu"
						onClick={() => setOpen((now) => !now)}
						className="bg-white/[0.13] px-3 py-2 text-neutral-200 transition-colors hover:bg-white/[0.18] lg:hidden"
					>
						{open ? "Close" : "Menu"}
					</button>
				</div>
			</div>
			{open ? (
				<nav
					id="pages-menu"
					aria-label="Pages, menu"
					className="mx-(--gutter) flex flex-col bg-[oklch(0.19_0.006_285)] p-2 lg:hidden"
				>
					{PAGES.map((page) => (
						<a key={page.label} href={page.href} className={`${LINK} px-3 py-3`}>
							{page.label}
						</a>
					))}
					<a href={signIn} className={`${LINK} px-3 py-3 sm:hidden`}>
						Sign in
					</a>
				</nav>
			) : null}
		</header>
	);
}
