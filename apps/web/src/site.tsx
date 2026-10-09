import { Footer } from "./footer.tsx";

/** The front pages, built section by section: the footer is in, the header is saved and off the page. */
export function Site() {
	return (
		<div className="flex min-h-dvh flex-col bg-black">
			<main aria-label="Maschina" className="min-h-[200dvh] flex-1" />
			<Footer />
		</div>
	);
}
