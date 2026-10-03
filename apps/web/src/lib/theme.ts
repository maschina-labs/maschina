import { useEffect, useState } from "react";
import type { Palette } from "../components/fog-background.tsx";
import { preview } from "./preview.ts";

/**
 * Themes. Dark and light are fixed. System follows the computer's own setting. Dynamic follows the
 * day: the fog moves through night, dawn, daylight, golden hour and dusk by the clock, and the screen
 * turns light by day and dark by night with it. Remembered in this browser only.
 */

export type Theme = "dark" | "light" | "system" | "dynamic" | "club";
export type Mode = "dark" | "light";

export const THEMES: { id: Theme; name: string }[] = [
	{ id: "dark", name: "Dark" },
	{ id: "light", name: "Light" },
	{ id: "system", name: "System" },
	{ id: "dynamic", name: "Dynamic" },
	// Black, graphite and one orange glow behind frosted glass: after a soft club advertisement Ash loves.
	{ id: "club", name: "Club" },
];

const KEY = "maschina.theme";
const CHANGED = "maschina:theme";

export function themeFrom(saved: string | null): Theme {
	return THEMES.some((each) => each.id === saved) ? (saved as Theme) : "dark";
}

/** Club: near black and graphite, warmed by a single orange glow, like light through frosted glass. */
const CLUB: Palette = {
	night: { l: 0.1, c: 0.002, h: 60 },
	top: { l: 0.15, c: 0.006, h: 55 },
	upper: { l: 0.21, c: 0.006, h: 55 },
	middle: { l: 0.27, c: 0.04, h: 50 },
	glow: { l: 0.64, c: 0.19, h: 45 },
};

/** Light or dark, for a theme, given the computer's setting and the hour (0 to 24, fractional). */
export function modeOf(
	theme: Theme,
	{ systemDark, hour }: { systemDark: boolean; hour: number },
): Mode {
	if (theme === "system") return systemDark ? "dark" : "light";
	if (theme === "dynamic") return skyAt(hour).night.l > 0.6 ? "light" : "dark";
	if (theme === "club") return "dark";
	return theme;
}

/**
 * The sky through the day, as fog palettes at set hours. Between two, every color is mixed, so the
 * change is continuous: no moment where the screen visibly switches. Night is the city palette itself.
 */
const NIGHT: Palette = {
	night: { l: 0.16, c: 0.002, h: 286 },
	top: { l: 0.246, c: 0.021, h: 136 },
	upper: { l: 0.367, c: 0.021, h: 232 },
	middle: { l: 0.405, c: 0.012, h: 72 },
	glow: { l: 0.471, c: 0.047, h: 77 },
};
// First light: deep violet above, rose through the middle, the sun coming up orange on the right.
const DAWN: Palette = {
	night: { l: 0.22, c: 0.02, h: 290 },
	top: { l: 0.32, c: 0.06, h: 295 },
	upper: { l: 0.46, c: 0.07, h: 345 },
	middle: { l: 0.58, c: 0.08, h: 30 },
	glow: { l: 0.74, c: 0.12, h: 60 },
};
// Daylight: a pale blue sky over a warm white haze.
const DAY: Palette = {
	night: { l: 0.93, c: 0.012, h: 240 },
	top: { l: 0.8, c: 0.06, h: 240 },
	upper: { l: 0.85, c: 0.045, h: 230 },
	middle: { l: 0.92, c: 0.018, h: 80 },
	glow: { l: 0.96, c: 0.04, h: 85 },
};
// Golden hour: the light low and orange, the sky going to violet above it.
const GOLDEN: Palette = {
	night: { l: 0.3, c: 0.03, h: 285 },
	top: { l: 0.38, c: 0.07, h: 285 },
	upper: { l: 0.52, c: 0.09, h: 330 },
	middle: { l: 0.62, c: 0.11, h: 40 },
	glow: { l: 0.75, c: 0.15, h: 55 },
};
// Dusk: the last blue, deep and cold, before the city lights take over.
const DUSK: Palette = {
	night: { l: 0.18, c: 0.02, h: 265 },
	top: { l: 0.26, c: 0.05, h: 265 },
	upper: { l: 0.36, c: 0.06, h: 280 },
	middle: { l: 0.42, c: 0.04, h: 40 },
	glow: { l: 0.5, c: 0.07, h: 60 },
};

const DAYLIGHT: [hour: number, palette: Palette][] = [
	[0, NIGHT],
	[5, NIGHT],
	[6.5, DAWN],
	[8.5, DAY],
	[16.5, DAY],
	[18.5, GOLDEN],
	[19.75, DUSK],
	[21, NIGHT],
	[24, NIGHT],
];

const mixNumber = (a: number, b: number, t: number) => a + (b - a) * t;
// Hues go the short way round the wheel, so violet to red does not pass through green.
const mixHue = (a: number, b: number, t: number) => {
	const turn = ((((b - a) % 360) + 540) % 360) - 180;
	return (a + turn * t + 360) % 360;
};
// Eased, so each stage settles in rather than arriving at a constant rate.
const ease = (t: number) => t * t * (3 - 2 * t);

export function skyAt(hour: number): Palette {
	const at = ((hour % 24) + 24) % 24;
	let index = DAYLIGHT.findIndex(([when]) => when > at);
	if (index <= 0) index = DAYLIGHT.length - 1;
	const [fromHour, from] = DAYLIGHT[index - 1] as [number, Palette];
	const [toHour, to] = DAYLIGHT[index] as [number, Palette];
	const t = ease((at - fromHour) / (toHour - fromHour));
	const mix = (key: keyof Palette) => ({
		l: mixNumber(from[key].l, to[key].l, t),
		c: mixNumber(from[key].c, to[key].c, t),
		h: mixHue(from[key].h, to[key].h, t),
	});
	return {
		night: mix("night"),
		top: mix("top"),
		upper: mix("upper"),
		middle: mix("middle"),
		glow: mix("glow"),
	};
}

const hourNow = () => {
	// For reviewing the sky: ?hour=18.5 holds the clock there, while developing.
	const asked = Number(preview("hour") ?? Number.NaN);
	if (Number.isFinite(asked)) return asked;
	const now = new Date();
	return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
};

function readTheme(): Theme {
	// ?theme=light and the like, while developing, to look at a theme without changing the saved one.
	const asked = preview("theme");
	if (asked) return themeFrom(asked);
	try {
		return themeFrom(localStorage.getItem(KEY));
	} catch {
		return "dark";
	}
}

export function setTheme(theme: Theme) {
	try {
		localStorage.setItem(KEY, theme);
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

/** The chosen theme, what it means right now, and for dynamic, the sky. Updates every minute. */
export function useTheme(): { theme: Theme; mode: Mode; sky?: Palette | undefined } {
	const [theme, setChosen] = useState(readTheme);
	const [systemDark, setSystemDark] = useState(
		() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
	);
	const [hour, setHour] = useState(hourNow);
	useEffect(() => {
		const changed = () => setChosen(readTheme());
		window.addEventListener(CHANGED, changed);
		const media = window.matchMedia?.("(prefers-color-scheme: dark)");
		const follow = (event: MediaQueryListEvent) => setSystemDark(event.matches);
		media?.addEventListener("change", follow);
		const clock = setInterval(() => setHour(hourNow()), 60_000);
		return () => {
			window.removeEventListener(CHANGED, changed);
			media?.removeEventListener("change", follow);
			clearInterval(clock);
		};
	}, []);
	const mode = modeOf(theme, { systemDark, hour });
	return {
		theme,
		mode,
		sky: theme === "dynamic" ? skyAt(hour) : theme === "club" ? CLUB : undefined,
	};
}
