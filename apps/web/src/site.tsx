import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";

/** The front pages, built one piece at a time: the header, the hero, and the footer. */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className="flex-1">
				<Hero authUrl={authUrl} />
			</main>
			<Footer />
		</div>
	);
}
