import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";

/** The front pages, built one piece at a time: the header and the footer are in, the hero is saved and off the page. */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="relative flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className="min-h-[200dvh] flex-1" />
			<Footer />
		</div>
	);
}
