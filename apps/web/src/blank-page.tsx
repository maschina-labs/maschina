import { Frame } from "./frame.tsx";
import { PageStrip } from "./page-strip.tsx";
import { useTitle } from "./use-title.ts";

/**
 * A page with nothing on it yet: the header and the footer with a full screen of nothing between them, so the footer
 * starts below the fold. Its name is on it but unseen, as the one heading, so a screen reader and a search engine know
 * where they are, and the browser tab is named after it.
 */
export function BlankPage({ authUrl, title }: { authUrl: string; title: string }) {
	useTitle(title);

	return (
		<Frame authUrl={authUrl} className="min-h-lvh border-b border-[oklch(0.94_0.012_245/0.12)]">
			<PageStrip />
			<h1 className="sr-only">{title}</h1>
		</Frame>
	);
}
