import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { createApi } from "./lib/api.ts";
import { config } from "./lib/env.ts";
import { createQueryClient } from "./lib/query.ts";
import { createAppRouter } from "./router.tsx";

// Loaded only when configured, so the first page doesn't wait for them.
if (config.VITE_SENTRY_DSN) {
	const dsn = config.VITE_SENTRY_DSN;
	void import("./lib/errors.ts").then(({ startErrorReporting }) => startErrorReporting(dsn));
}

const queryClient = createQueryClient();
const router = createAppRouter({ api: createApi(config.VITE_GATEWAY_URL), queryClient });

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
