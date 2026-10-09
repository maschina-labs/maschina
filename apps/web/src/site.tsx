import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { Hero } from "./hero.tsx";
import { Proof } from "./proof.tsx";

/** The front pages, built one piece at a time: the header, the hero, the proof section under it, and the footer. */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className="flex-1">
				<Hero authUrl={authUrl} />
				<Proof />
			</main>
			<Footer />
		</div>
	);
}
