import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Deck, sectionIndex } from "../components/deck.tsx";
import { Detail } from "../components/detail.tsx";
import { Edges, SideRail } from "../components/edges.tsx";
import { FogBackground } from "../components/fog-background.tsx";
import { FoggedGlass, Grain } from "../components/fogged-glass.tsx";
import { RainGlass } from "../components/rain-glass.tsx";
import { Search } from "../components/search.tsx";
import { Broken, OfflineBanner } from "../components/system.tsx";
import { Toaster } from "../components/toaster.tsx";
import type { Api } from "../lib/api.ts";
import { failureMessage } from "../lib/failure.ts";
import { useTheme } from "../lib/theme.ts";
import { useWeather } from "../lib/weather.ts";

export type RouterContext = {
	api: Api;
	queryClient: QueryClient;
};

/**
 * The whole screen: the field (fog, glass, grain), the deck of sections on it, the edges and their
 * panels, and the detail layer over the deck whenever something deeper is open. Nothing scrolls the
 * page itself.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
	component: Field,
	// The real message, not a friendlier one. Whoever is reading it is whoever can fix it.
	errorComponent: ({ error, reset }) => <Broken detail={failureMessage(error)} retry={reset} />,
});

function Field() {
	const { theme, mode, sky } = useTheme();
	// The weather where you are, for the dynamic theme only: it is the one that follows the world outside.
	const weather = useWeather(theme === "dynamic");
	// The sections slide on one strip; every other page is drawn on its own.
	const path = useRouterState({ select: (state) => state.location.pathname });
	const section = sectionIndex(path) >= 0;
	// The section to keep underneath while something is open over it: the last one you were on.
	const [behind, setBehind] = useState("/");
	useEffect(() => {
		if (section) setBehind(path);
	}, [section, path]);
	return (
		<div className="fixed inset-0 overflow-hidden">
			<FogBackground mode={mode} sky={sky} weather={weather} />
			{weather.rain !== "none" ? <RainGlass rain={weather.rain} /> : null}
			<FoggedGlass mode={mode} />
			<div className="relative z-10 h-full">
				<Deck behind={behind} />
			</div>
			<SideRail />
			{section ? null : <Detail back={behind} />}
			<Edges />
			<Search />
			<Toaster />
			<OfflineBanner />
			<Grain />
		</div>
	);
}
