import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Failure, failureMessage } from "../components/failure.tsx";
import type { Api } from "../lib/api.ts";

export type RouterContext = {
	api: Api;
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	component: Outlet,
	notFoundComponent: NotFound,
	errorComponent: ({ error }) => <Failure message={failureMessage(error)} />,
});

function NotFound() {
	return <p className="p-10 text-muted-foreground">There's nothing here.</p>;
}
