import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";

/** The front pages, built one piece at a time: the header, the hero background, and the footer. */
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
