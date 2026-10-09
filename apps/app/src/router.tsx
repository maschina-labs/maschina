import type { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import type { Api } from "./lib/api.ts";
import { routeTree } from "./routeTree.gen.ts";

export function createAppRouter(context: {
	api: Api;
	queryClient: QueryClient;
	/** Tests start the app at a path; the browser supplies its own. */
	history?: RouterHistory;
}) {
	const { history, ...rest } = context;
	return createRouter({
		routeTree,
		context: rest,
		defaultPreload: "intent",
		scrollRestoration: true,
		...(history ? { history } : {}),
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
