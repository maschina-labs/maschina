import RaindropFX from "raindrop-fx";
import { useEffect, useRef, useState } from "react";
import type { Weather } from "../lib/weather.ts";
import { fogCanvas } from "./fog-background.tsx";

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
	const canvas = useRef<HTMLCanvasElement>(null);
	// The city's canvas is made a moment after the page, so the glass waits for it.
	const [city, setCity] = useState(fogCanvas.current);
	useEffect(() => {
		if (city) return;
		const wait = setInterval(() => {
			if (fogCanvas.current) setCity(fogCanvas.current);
		}, 100);
		return () => clearInterval(wait);
	}, [city]);

	useEffect(() => {
		const element = canvas.current;
		if (!element || !city) return;
		// Drawn at the screen's real size, unlike the fog: drops are sharp things and must look it.
		const scale = Math.min(window.devicePixelRatio || 1, 2);
		const size = () =>
			[Math.round(window.innerWidth * scale), Math.round(window.innerHeight * scale)] as const;
		const [width, height] = size();
		element.width = width;
		element.height = height;
		const fx = new RaindropFX({
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
		let alive = true;
		void fx.start();
		// One copy at a time, and never of an empty canvas: a copy taken mid-resize, or a second one started
		// before the first is done, leaves the glass with no picture and it draws black.
		let copying = false;
		const refresh = setInterval(() => {
			if (!alive || copying || city.width === 0 || city.height === 0) return;
			copying = true;
			fx.setBackground(city).finally(() => {
				copying = false;
			});
		}, REFRESH_MS);
		const resize = () => {
			const [w, h] = size();
			element.width = w;
			element.height = h;
			fx.resize(w, h);
		};
		window.addEventListener("resize", resize);
		return () => {
			alive = false;
			clearInterval(refresh);
			window.removeEventListener("resize", resize);
			fx.stop();
		};
	}, [rain, city]);

	return (
		<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
			<canvas ref={canvas} className="h-full w-full" />
		</div>
	);
}
