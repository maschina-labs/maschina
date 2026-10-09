import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Site } from "./site.tsx";

// Where sign in and sign up live: auth.maschina.dev, or the local auth app while developing (.env).
const authUrl = import.meta.env.VITE_AUTH_URL ?? "https://auth.maschina.dev";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<Site authUrl={authUrl} />
	</StrictMode>,
);
