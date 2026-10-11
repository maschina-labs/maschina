import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AuthApp } from "./app.tsx";
import { peopleApi } from "./people-api.ts";

// The gateway answers every sign in; the app is where a person goes afterwards unless a link asked for another Maschina address.
const gateway = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";
const appUrl = import.meta.env.VITE_APP_URL ?? "https://app.maschina.dev";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<AuthApp
			path={window.location.pathname}
			search={window.location.search}
			api={peopleApi(gateway)}
			appUrl={appUrl}
			origin={window.location.origin}
			go={(address) => window.location.assign(address)}
		/>
	</StrictMode>,
);
