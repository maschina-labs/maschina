import { useEffect, useState } from "react";

/** How far the page has to scroll before the header lets go of the top edge. */
const DETACH_AT = 24;

/**
 * The top of every page: the wordmark on the left, and the way in on the right. Every box is square, like
 * the rest of Maschina. At the top of the page it is attached, flush with the edge; once the page scrolls
 * it detaches into a floating bar with a margin all round, on a solid surface (no blur). The sign in and
 * sign up pages live on auth.maschina.dev, so where auth is comes in from outside.
 */
export function Header({ authUrl }: { authUrl: string }) {
	const [detached, setDetached] = useState(
		() => typeof window !== "undefined" && window.scrollY > DETACH_AT,
	);

	useEffect(() => {
		const onScroll = () => setDetached(window.scrollY > DETACH_AT);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			data-detached={detached}
			className={`fixed inset-x-0 top-0 z-40 transition-[padding] duration-300 ease-out ${detached ? "px-(--gutter) pt-3 sm:pt-4" : "p-0"}`}
		>
			<div
				className={`flex items-center justify-between transition-[padding,background-color] duration-300 ease-out ${detached ? "bg-[oklch(0.19_0.006_285)] px-3 py-2.5 sm:px-5 sm:py-3" : "bg-transparent px-(--gutter) py-6"}`}
			>
				<a href="/" aria-label="Maschina, home">
					<img src="/brand/wordmark.svg" alt="Maschina" className="h-4 w-auto sm:h-6" />
				</a>
				<nav
					aria-label="Account"
					className="flex items-center gap-2 text-[13px] sm:gap-3 sm:text-[14px]"
				>
					<a
						href={`${authUrl}/sign-in`}
						className="bg-white/[0.13] px-3 py-2 text-neutral-200 sm:px-4 transition-colors hover:bg-white/[0.18]"
					>
						Sign in
					</a>
					<a
						href={`${authUrl}/sign-up`}
						className="bg-[oklch(0.93_0.02_300)] px-3 py-2 text-black sm:px-4 transition-colors hover:bg-[oklch(0.98_0.015_300)]"
					>
						Sign up
					</a>
				</nav>
			</div>
		</header>
	);
}
