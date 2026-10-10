import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { startAnalytics } from "./analytics.ts";
import { App } from "./app.tsx";
import { loadLanguage } from "./i18n/languages.ts";
import { parsePath } from "./i18n/locales.ts";

// Where sign in and sign up live: auth.maschina.dev, or the local auth app while developing (.env).
const authUrl = import.meta.env.VITE_AUTH_URL ?? "https://auth.maschina.dev";

// Product analytics: PostHog, and only once the visitor has accepted optional cookies. With no key it does nothing.
startAnalytics({
	key: import.meta.env.VITE_POSTHOG_KEY,
	host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
});

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

// The words of the language in the address come first, as a file of their own, so the page is drawn once, in it.
await loadLanguage(parsePath(window.location.pathname).locale);

createRoot(root).render(
	<StrictMode>
		<App authUrl={authUrl} />
	</StrictMode>,
);
