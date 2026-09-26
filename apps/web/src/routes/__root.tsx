import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { failureMessage } from "../components/failure.tsx";
import { Broken, NotFound } from "../components/states.tsx";
import type { Api } from "../lib/api.ts";

export type RouterContext = {
	api: Api;
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	component: Outlet,
	notFoundComponent: NotFound,
	// The real message, not a friendlier one. Whoever is reading it is whoever can fix it.
	errorComponent: ({ error, reset }) => <Broken detail={failureMessage(error)} reset={reset} />,
});
