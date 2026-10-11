import { PREFERENCE_CHANGED, readPreference } from "./preferences.ts";

const COOKIE = "maschina_visitor";
const YEAR = 365 * 24 * 60 * 60;

type Settings = { key: string | undefined; host: string };

function visitor(): string | null {
	const found = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${COOKIE}=`));
	return found ? found.slice(COOKIE.length + 1) : null;
}

function remember(id: string) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet, and one plain cookie is all this needs
	document.cookie = `${COOKIE}=${id}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`;
}

function forget() {
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet, and one plain cookie is all this needs
	document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Product analytics, through PostHog, and only if the visitor has accepted optional cookies. It sends one thing, the page
 * that was opened (its address, its path and where the visitor came from), with a random number kept in one first party
 * cookie so a return visit can be told from a new one. It sends no text the visitor typed and nothing about a wallet or a
 * person. Without a key it does nothing, so a missing setting never half works. When the visitor declines, the cookie is
 * taken away. It returns a function that stops listening. This is exactly what the privacy policy says, and the two have to change together.
 */
export function startAnalytics({ key, host }: Settings): () => void {
	if (!key) return () => {};
	let counted = false;

	const run = () => {
		if (readPreference() !== "accepted") {
			forget();
			return;
		}
		if (counted) return;
		counted = true;
		let id = visitor();
		if (!id) {
			id = crypto.randomUUID();
			remember(id);
		}
		// A failed request is ignored: analytics must never break the page.
		void fetch(`${host}/i/v0/e/`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				api_key: key,
				event: "$pageview",
				distinct_id: id,
				properties: {
					$current_url: window.location.href,
					$pathname: window.location.pathname,
					$referrer: document.referrer,
				},
			}),
			keepalive: true,
		}).catch(() => {});
	};

	run();
	window.addEventListener(PREFERENCE_CHANGED, run);
	return () => window.removeEventListener(PREFERENCE_CHANGED, run);
}
