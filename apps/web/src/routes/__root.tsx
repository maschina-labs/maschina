import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Deck, sectionIndex } from "../components/deck.tsx";
import { Detail } from "../components/detail.tsx";
import { Edges, SideRail, useOpenEdge } from "../components/edges.tsx";
import { cityTint, FogBackground } from "../components/fog-background.tsx";
import { FoggedGlass, Grain } from "../components/fogged-glass.tsx";
import { RainGlass } from "../components/rain-glass.tsx";
import { Splash, useSplash } from "../components/splash.tsx";
import { Broken, HaltBanner, OfflineBanner, PaperBanner } from "../components/system.tsx";
import { TabTitle } from "../components/tab-title.tsx";
import { Toaster } from "../components/toaster.tsx";
import { WalletPicker } from "../components/wallet-picker.tsx";
import type { Api } from "../lib/api.ts";
import { failureMessage } from "../lib/failure.ts";
import { INK_KEYS, inkFor } from "../lib/ink.ts";
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
	const { choice, mode, sky, brand, weather: wantsWeather } = useTheme();
	const accent = brand?.accent;
	const onAccent = brand?.onAccent;
	const inkHue = brand?.sky.glow.h;
	// Which side an open sidebar pushes the page from, on a desktop only. One at a time.
	const edge = useOpenEdge();
	const pushedFrom =
		edge === "left"
			? "left"
			: edge === "right" || edge === "account" || edge === "sections"
				? "right"
				: undefined;
	const splash = useSplash();
	// The page's whole palette follows the mode, from one attribute: see the light mode block in styles.css.
	useEffect(() => {
		document.documentElement.dataset["mode"] = mode;
	}, [mode]);
	// Whose colors, and for a team's palette, the accent that what is chosen or pressed glows in.
	useEffect(() => {
		const root = document.documentElement;
		root.dataset["theme"] = choice.palette;
		if (accent && onAccent) {
			root.dataset["accent"] = "on";
			root.style.setProperty("--accent", accent);
			root.style.setProperty("--on-accent", onAccent);
			// The charts draw in the team's own color, and the text takes its hue.
			root.style.setProperty("--chart", accent);
			for (const [key, color] of Object.entries(inkFor(inkHue ?? 0, mode)))
				root.style.setProperty(key, color);
		} else {
			delete root.dataset["accent"];
			root.style.removeProperty("--accent");
			root.style.removeProperty("--on-accent");
			for (const key of INK_KEYS) root.style.removeProperty(key);
			root.style.removeProperty("--chart");
		}
	}, [choice.palette, accent, onAccent, inkHue, mode]);
	// The city's hue, for the sidebars to take on: they follow the theme, and the sky in dynamic.
	useEffect(() => {
		const { cool, warm } = cityTint(mode, sky);
		document.documentElement.style.setProperty("--tint-cool", cool);
		document.documentElement.style.setProperty("--tint-warm", warm);
	}, [mode, sky]);
	// The weather where you are, only with a dynamic sky: that is the one that follows the world outside.
	const weather = useWeather(wantsWeather);
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
			<FogBackground
				mode={mode}
				sky={sky}
				weather={weather}
				field={choice.field}
				motion={choice.motion}
			/>
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
					// The app waits for the logo to fade out completely, then fades in over a second.
					opacity: splash === "done" ? 1 : 0,
					transition:
						"left 420ms cubic-bezier(0.32,0.72,0,1), right 420ms cubic-bezier(0.32,0.72,0,1), opacity 1000ms ease-in-out",
				}}
			>
				<div className="relative h-full">
					<Deck behind={behind} />
				</div>
				{/* A fresh screen for every address, so one half closed can never linger over the next. */}
				{section ? null : <Detail key={path} back={behind} />}
			</div>
			<SideRail />
			<Edges />
			<Toaster />
			<WalletPicker />
			{/* The banners wait behind the logo too, so it opens on nothing but the name. */}
			<div
				className="transition-opacity duration-1000 ease-in-out"
				style={{ opacity: splash === "done" ? 1 : 0 }}
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
