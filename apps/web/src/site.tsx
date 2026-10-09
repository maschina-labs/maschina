import { Closing } from "./closing.tsx";
import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";
import { HowItWorks } from "./how-it-works.tsx";
import { Showcase } from "./showcase.tsx";

/**
 * The front pages, built one piece at a time: the header, the hero, the app showcase, how it works, the closing section, and the footer, as
 * plain sections one after the other. What goes between them comes later.
 */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main>
				<Hero authUrl={authUrl} />
				<Showcase />
				<HowItWorks />
				<Closing />
			</main>
			<Footer />
		</div>
	);
}
