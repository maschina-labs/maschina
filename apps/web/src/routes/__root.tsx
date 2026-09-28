import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { CommandPalette } from "../components/command-palette.tsx";
import { FogBackground } from "../components/fog-background.tsx";
import { FoggedGlass, Grain } from "../components/fogged-glass.tsx";
import { Frame } from "../components/frame.tsx";
import { Broken, NotFound, OfflineBanner } from "../components/status-pages.tsx";
import { TabTitle } from "../components/tab-title.tsx";
import { Toaster } from "../components/toaster.tsx";
import type { Api } from "../lib/api.ts";
import { failureMessage } from "../lib/failure.ts";

export type RouterContext = {
	api: Api;
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => (
		<>
			<FogBackground />
			<FoggedGlass />
			<div className="relative z-10">
				<Frame>
					<Outlet />
				</Frame>
			</div>
			<Grain />
			<Toaster />
			<OfflineBanner />
			<TabTitle />
			<CommandPalette />
		</>
	),
	notFoundComponent: NotFound,
	// The real message, not a friendlier one. Whoever is reading it is whoever can fix it.
	errorComponent: ({ error, reset }) => <Broken detail={failureMessage(error)} retry={reset} />,
});
