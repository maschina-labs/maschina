import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import type { Api } from "../lib/api.ts";

export type RouterContext = {
	api: Api;
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
	notFoundComponent: NotFound,
	errorComponent: ({ error }) => (
		<Failure message={error instanceof Error ? error.message : "Unexpected error"} />
	),
});

function RootLayout() {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="border-b">
				<nav className="mx-auto flex h-14 max-w-6xl items-center px-4">
					<Link to="/" className="font-semibold tracking-tight">
						Maschina
					</Link>
				</nav>
			</header>
			<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
				<Outlet />
			</main>
		</div>
	);
}

function NotFound() {
	return <p className="text-muted-foreground">There's nothing here.</p>;
}

function Failure({ message }: { message: string }) {
	return (
		<div role="alert" className="rounded-lg border border-destructive/40 p-4">
			<p className="font-medium">Something went wrong.</p>
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
