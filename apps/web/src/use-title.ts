import { useEffect } from "react";

/** Names the browser tab after the page, and puts the old name back when the page goes. */
export function useTitle(title: string) {
	useEffect(() => {
		const before = document.title;
		document.title = `${title} · Maschina`;
		return () => {
			document.title = before;
		};
	}, [title]);
}
