import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Deck, sectionIndex } from "../components/deck.tsx";
import { Detail } from "../components/detail.tsx";
import { Edges, SideRail, useOpenEdge } from "../components/edges.tsx";
import { FogBackground } from "../components/fog-background.tsx";
import { FoggedGlass, Grain } from "../components/fogged-glass.tsx";
import { RainGlass } from "../components/rain-glass.tsx";
import { Search } from "../components/search.tsx";
import { Splash, useSplash } from "../components/splash.tsx";
import { Broken, HaltBanner, OfflineBanner, PaperBanner } from "../components/system.tsx";
import { TabTitle } from "../components/tab-title.tsx";
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
	// Which side an open sidebar pushes the page from, on a desktop only. One at a time.
	const edge = useOpenEdge();
	const pushedFrom =
		edge === "left"
			? "left"
			: edge === "right" || edge === "account" || edge === "sections"
				? "right"
				: undefined;
	const splash = useSplash();
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
		<div className="fixed inset-0 overflow-hidden [--side:0px] md:[--side:340px]">
			<FogBackground mode={mode} sky={sky} weather={weather} />
			{weather.rain !== "none" ? <RainGlass rain={weather.rain} /> : null}
			<FoggedGlass mode={mode} />
			{/*
			 * The stage: the page, and anything opened over it. On a desktop an open sidebar takes its room
			 * from here, so the tiles shrink and recentre in what is left rather than being covered. Tiles
			 * size themselves from the stage (cqw, cqh), and the transform keeps the detail layer inside it.
			 */}
			<div
				className="absolute inset-y-0 z-10 [container-type:size] [transform:translateZ(0)]"
				style={{
					left: pushedFrom === "left" ? "var(--side)" : 0,
					right: pushedFrom === "right" ? "var(--side)" : 0,
					// The app fades in over a second as the logo fades out, the first time it opens on a visit.
					opacity: splash === "mark" ? 0 : 1,
					transition:
						"left 420ms cubic-bezier(0.32,0.72,0,1), right 420ms cubic-bezier(0.32,0.72,0,1), opacity 1000ms ease-out",
				}}
			>
				<div className="relative h-full">
					<Deck behind={behind} />
				</div>
				{section ? null : <Detail back={behind} />}
			</div>
			<SideRail />
			<Edges />
			<Search />
			<Toaster />
			{/* The banners wait behind the logo too, so it opens on nothing but the name. */}
			<div
				className="transition-opacity duration-1000 ease-out"
				style={{ opacity: splash === "mark" ? 0 : 1 }}
			>
				<OfflineBanner />
				<HaltBanner />
				<PaperBanner />
			</div>
			<TabTitle />
			<Splash phase={splash} />
			<Grain />
		</div>
	);
}
