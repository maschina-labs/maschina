import { useEffect } from "react";
import { Frame } from "./frame.tsx";

/**
 * A page with nothing on it yet: the header and the footer with nothing between them, so the footer sits at the
 * bottom of the screen. Its name is on it but unseen, as the one heading, so a screen reader and a search engine know
 * where they are, and the browser tab is named after it.
 */
export function BlankPage({ authUrl, title }: { authUrl: string; title: string }) {
	useEffect(() => {
		const before = document.title;
		document.title = `${title} · Maschina`;
		return () => {
			document.title = before;
		};
	}, [title]);

	return (
		<Frame authUrl={authUrl} className="flex-1">
			<h1 className="sr-only">{title}</h1>
		</Frame>
	);
}
