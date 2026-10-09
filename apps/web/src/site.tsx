import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";

/** The front pages, built section by section: the header, the hero, then the footer. */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className="min-h-[200dvh] flex-1">
				<Hero />
			</main>
			<Footer />
		</div>
	);
}
