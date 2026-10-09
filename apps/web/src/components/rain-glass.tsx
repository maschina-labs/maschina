import { fogCanvas } from "@maschina/field";
import { useEffect, useRef, useState } from "react";
import type { Weather } from "../lib/weather.ts";

/**
 * Rain on the window. The city stays where it is, behind the glass; this is the glass in front of it,
 * with drops that bead, slip and run down, leaving trails, and mist that gathers between them. Each
 * drop is a small lens, so it shows the city lights bent and upside down, the way a real one does.
 *
 * The drops come from raindrop-fx. It wants a still picture behind it, and the city drifts, so it is
 * handed a fresh copy of the city a few times a second. The fog moves far too slowly for that to show.
 */

type Rain = Exclude<Weather["rain"], "none">;

// How hard it is raining, as the library's own settings. Drizzle is mostly mist and fine beads; heavy
// rain is big drops arriving often and running fast.
const STRENGTH: Record<
	Rain,
	{
		spawnInterval: [number, number];
		spawnSize: [number, number];
		dropletsPerSeconds: number;
		spawnLimit: number;
	}
> = {
	drizzle: {
		spawnInterval: [0.4, 0.9],
		spawnSize: [28, 60],
		dropletsPerSeconds: 260,
		spawnLimit: 120,
	},
	rain: {
		spawnInterval: [0.08, 0.3],
		spawnSize: [40, 90],
		dropletsPerSeconds: 500,
		spawnLimit: 400,
	},
	heavy: {
		spawnInterval: [0.02, 0.08],
		spawnSize: [50, 110],
		dropletsPerSeconds: 900,
		spawnLimit: 800,
	},
};

/** How often the glass takes a new picture of the city behind it. */
const REFRESH_MS = 250;

export function RainGlass({ rain }: { rain: Rain }) {
	const holder = useRef<HTMLDivElement>(null);
	// The city's canvas is made a moment after the page, so the glass waits for it, and it is made again
	// whenever the theme changes, so the glass follows it there. Holding on to the old one showed the half
	// of its last frame a discarded canvas keeps: a dark triangle across the page.
	const [city, setCity] = useState(fogCanvas.current);
	useEffect(() => {
		const follow = setInterval(() => {
			const now = fogCanvas.current;
			if (now && now !== city && now.isConnected) setCity(now);
		}, 250);
		return () => clearInterval(follow);
	}, [city]);

	useEffect(() => {
		const box = holder.current;
		if (!box || !city) return;
		/*
		 * Every glass draws on a canvas of its own, made here and taken away with it. Two glasses once shared
		 * one canvas, and so one WebGL context: a theme change replaced the glass while the first was still
		 * starting, its loop began anyway once it had, and the two drew halves of each other's frames, a
		 * diagonal block across the page (MISTAKES M45).
		 */
		const element = document.createElement("canvas");
		element.className = "h-full w-full";
		box.appendChild(element);
		// Drawn at the screen's real size, unlike the fog: drops are sharp things and must look it.
		const scale = Math.min(window.devicePixelRatio || 1, 2);
		const size = () =>
			[Math.round(window.innerWidth * scale), Math.round(window.innerHeight * scale)] as const;
		const [width, height] = size();
		element.width = width;
		element.height = height;
		let alive = true;
		let fx: InstanceType<typeof import("raindrop-fx")> | undefined;
		let refresh: ReturnType<typeof setInterval> | undefined;
		// Loaded only when it rains: most visits never need it, and it is the largest thing on the page.
		void import("raindrop-fx").then(({ default: RaindropFX }) => {
			if (!alive) return;
			const glass = new RaindropFX({
				canvas: element,
				background: city,
				...STRENGTH[rain],
				// The city behind is already out of focus, so the glass blurs it only a little more.
				backgroundBlurSteps: 1,
				mist: true,
				mistColor: [0.02, 0.02, 0.025, 1],
				mistTime: 12,
				mistBlurStep: 3,
				dropletSize: [8, 22],
				smoothRaindrop: [0.95, 1.0],
				refractBase: 0.4,
				refractScale: 0.6,
				raindropCompose: "smoother",
				raindropLightPos: [-1, 1, 2, 0],
				raindropDiffuseLight: [0.2, 0.2, 0.2],
				raindropShadowOffset: 0.8,
				raindropSpecularLight: [0, 0, 0],
				raindropLightBump: 0.7,
			});
			fx = glass;
			// Starting takes a moment. A glass replaced in that moment still begins its loop once started,
			// so it is stopped again then rather than left drawing.
			void glass.start().then(() => {
				if (!alive) glass.stop();
			});
			// One copy at a time, and never of an empty canvas: a copy taken mid-resize, or a second one
			// started before the first is done, leaves the glass with no picture and it draws black.
			let copying = false;
			refresh = setInterval(() => {
				if (!alive || copying || city.width === 0 || city.height === 0) return;
				copying = true;
				glass.setBackground(city).finally(() => {
					copying = false;
				});
			}, REFRESH_MS);
		});
		const resize = () => {
			const [w, h] = size();
			element.width = w;
			element.height = h;
			fx?.resize(w, h);
		};
		window.addEventListener("resize", resize);
		return () => {
			alive = false;
			if (refresh) clearInterval(refresh);
			window.removeEventListener("resize", resize);
			fx?.stop();
			// Its context goes with it, so nothing it left behind can ever be drawn again.
			try {
				element.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
			} catch {}
			element.remove();
		};
	}, [rain, city]);

	return <div ref={holder} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
