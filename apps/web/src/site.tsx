import { Footer } from "./footer.tsx";

/** The front pages: blank while their design is settled, the footer first. */
export function Site() {
	return (
		<div className="flex min-h-dvh flex-col bg-black">
			<main aria-label="Maschina" className="flex-1" />
			<Footer />
		</div>
	);
}
