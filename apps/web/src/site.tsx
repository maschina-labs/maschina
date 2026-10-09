import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";

/** The front pages: blank while their design is settled, the footer first. */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<div className="flex min-h-dvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main aria-label="Maschina" className="min-h-[200dvh] flex-1" />
			<Footer />
		</div>
	);
}
