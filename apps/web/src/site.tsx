import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";

/**
 * The front pages, built one piece at a time: the header, the hero, and the footer. The hero is pinned to the
 * top of the page and the footer, a full screen of its own, rolls up over it. What goes between them comes later.
 */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className="sticky top-0 z-0">
				<Hero authUrl={authUrl} />
			</main>
			<Footer />
		</div>
	);
}
