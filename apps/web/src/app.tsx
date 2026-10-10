import { BlankPage } from "./blank-page.tsx";
import { TERMS } from "./legal/terms.ts";
import { LegalPage } from "./legal.tsx";
import { titleFor } from "./routes.ts";
import { Site } from "./site.tsx";

/**
 * Which page an address shows: the front page at the root, a blank page for each address in routes.ts, and the front
 * page for any other address until it has a page of its own. The address is a plain argument so a test can stand in
 * for the browser's.
 */
export function App({
	authUrl,
	path = window.location.pathname,
}: {
	authUrl: string;
	path?: string;
}) {
	const clean = path.replace(/\/+$/, "") || "/";
	if (clean === "/terms") return <LegalPage authUrl={authUrl} doc={TERMS} />;
	const title = titleFor(path);
	if (title) return <BlankPage authUrl={authUrl} title={title} />;
	return <Site authUrl={authUrl} />;
}
