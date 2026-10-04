import { useEffect, useState } from "react";
import type { Palette } from "../components/fog-background.tsx";
import { preview } from "./preview.ts";

/**
 * Themes. Dark and light are fixed. System follows the computer's own setting. Dynamic follows the
 * day: the fog moves through night, dawn, daylight, golden hour and dusk by the clock, and the screen
 * turns light by day and dark by night with it. Remembered in this browser only.
 */

/** One look of a tribute theme: the city's colors, and the accent for whatever is chosen or pressed. */
export type Look = { sky: Palette; accent: string; onAccent: string };
type Brand = { name: string; dark: Look; light: Look };

/*
 * Tribute themes, after Solana teams Ash admires: their colors only, never their marks. Each comes dark
 * and light, the light one saved as its name with -light on the end.
 */
const BRANDS = {
	// Black and graphite, warmed by Helius orange; or the same orange on a pale city.
	helius: {
		name: "Helius",
		dark: {
			sky: {
				night: { l: 0.1, c: 0.002, h: 60 },
				top: { l: 0.15, c: 0.006, h: 55 },
				upper: { l: 0.21, c: 0.006, h: 55 },
				middle: { l: 0.27, c: 0.04, h: 45 },
				glow: { l: 0.64, c: 0.2, h: 38 },
			},
			accent: "oklch(66% 0.21 38)",
			onAccent: "oklch(14% 0.01 40)",
		},
		light: {
			sky: {
				night: { l: 0.95, c: 0.004, h: 60 },
				top: { l: 0.88, c: 0.02, h: 50 },
				upper: { l: 0.82, c: 0.06, h: 42 },
				middle: { l: 0.74, c: 0.12, h: 38 },
				glow: { l: 0.7, c: 0.19, h: 38 },
			},
			accent: "oklch(62% 0.21 38)",
			onAccent: "oklch(98% 0.01 40)",
		},
	},
	// ORE Supply (ore.com): gold in black regolith; or gold on pale sand. Warm, deep gold, not lemon.
	ore: {
		name: "Ore",
		dark: {
			sky: {
				night: { l: 0.09, c: 0.006, h: 75 },
				top: { l: 0.14, c: 0.015, h: 75 },
				upper: { l: 0.22, c: 0.04, h: 78 },
				middle: { l: 0.36, c: 0.1, h: 78 },
				glow: { l: 0.74, c: 0.15, h: 80 },
			},
			accent: "oklch(79% 0.15 80)",
			onAccent: "oklch(14% 0.02 75)",
		},
		light: {
			sky: {
				night: { l: 0.94, c: 0.02, h: 82 },
				top: { l: 0.89, c: 0.045, h: 80 },
				upper: { l: 0.84, c: 0.08, h: 80 },
				middle: { l: 0.78, c: 0.12, h: 78 },
				glow: { l: 0.74, c: 0.15, h: 78 },
			},
			accent: "oklch(72% 0.15 76)",
			onAccent: "oklch(14% 0.02 75)",
		},
	},
	// Jupiter: deep teal night and its lime green; or lime over pale mint.
	jupiter: {
		name: "Jupiter",
		dark: {
			sky: {
				night: { l: 0.14, c: 0.02, h: 230 },
				top: { l: 0.2, c: 0.035, h: 225 },
				upper: { l: 0.3, c: 0.05, h: 200 },
				middle: { l: 0.42, c: 0.08, h: 170 },
				glow: { l: 0.82, c: 0.17, h: 125 },
			},
			accent: "oklch(89% 0.17 125)",
			onAccent: "oklch(18% 0.03 230)",
		},
		light: {
			sky: {
				night: { l: 0.95, c: 0.015, h: 190 },
				top: { l: 0.9, c: 0.035, h: 200 },
				upper: { l: 0.86, c: 0.06, h: 180 },
				middle: { l: 0.84, c: 0.1, h: 150 },
				glow: { l: 0.86, c: 0.16, h: 125 },
			},
			accent: "oklch(84% 0.18 128)",
			onAccent: "oklch(18% 0.03 230)",
		},
	},
	// Solana: violet above, the green coming up beneath it; by day, pale violet and the same green.
	solana: {
		name: "Solana",
		dark: {
			sky: {
				night: { l: 0.12, c: 0.03, h: 295 },
				top: { l: 0.22, c: 0.12, h: 300 },
				upper: { l: 0.36, c: 0.16, h: 300 },
				middle: { l: 0.46, c: 0.1, h: 200 },
				glow: { l: 0.82, c: 0.18, h: 160 },
			},
			accent: "oklch(85% 0.19 160)",
			onAccent: "oklch(16% 0.04 295)",
		},
		light: {
			sky: {
				night: { l: 0.95, c: 0.015, h: 300 },
				top: { l: 0.88, c: 0.05, h: 300 },
				upper: { l: 0.82, c: 0.09, h: 300 },
				middle: { l: 0.86, c: 0.08, h: 190 },
				glow: { l: 0.84, c: 0.15, h: 160 },
			},
			accent: "oklch(58% 0.25 300)",
			onAccent: "oklch(98% 0.01 300)",
		},
	},
	// Phantom: soft lavender, on a dusky purple or a pale one.
	phantom: {
		name: "Phantom",
		dark: {
			sky: {
				night: { l: 0.14, c: 0.02, h: 290 },
				top: { l: 0.22, c: 0.05, h: 288 },
				upper: { l: 0.32, c: 0.08, h: 290 },
				middle: { l: 0.44, c: 0.1, h: 292 },
				glow: { l: 0.76, c: 0.11, h: 292 },
			},
			accent: "oklch(78% 0.11 292)",
			onAccent: "oklch(18% 0.04 292)",
		},
		light: {
			sky: {
				night: { l: 0.96, c: 0.01, h: 290 },
				top: { l: 0.91, c: 0.03, h: 290 },
				upper: { l: 0.86, c: 0.06, h: 292 },
				middle: { l: 0.8, c: 0.09, h: 292 },
				glow: { l: 0.76, c: 0.12, h: 292 },
			},
			accent: "oklch(66% 0.14 292)",
			onAccent: "oklch(98% 0.01 292)",
		},
	},
	// Backpack: its red, on near black or on white.
	backpack: {
		name: "Backpack",
		dark: {
			sky: {
				night: { l: 0.11, c: 0.004, h: 25 },
				top: { l: 0.16, c: 0.01, h: 25 },
				upper: { l: 0.22, c: 0.02, h: 25 },
				middle: { l: 0.3, c: 0.07, h: 25 },
				glow: { l: 0.6, c: 0.2, h: 25 },
			},
			accent: "oklch(63% 0.21 25)",
			onAccent: "oklch(98% 0.01 25)",
		},
		light: {
			sky: {
				night: { l: 0.96, c: 0.004, h: 25 },
				top: { l: 0.9, c: 0.02, h: 25 },
				upper: { l: 0.84, c: 0.05, h: 25 },
				middle: { l: 0.76, c: 0.1, h: 25 },
				glow: { l: 0.68, c: 0.18, h: 25 },
			},
			accent: "oklch(60% 0.22 25)",
			onAccent: "oklch(98% 0.01 25)",
		},
	},
	// Solflare: its yellow running into orange, out of black or out of cream.
	solflare: {
		name: "Solflare",
		dark: {
			sky: {
				night: { l: 0.1, c: 0.004, h: 70 },
				top: { l: 0.15, c: 0.01, h: 70 },
				upper: { l: 0.22, c: 0.03, h: 60 },
				middle: { l: 0.36, c: 0.09, h: 50 },
				glow: { l: 0.86, c: 0.17, h: 100 },
			},
			accent: "oklch(93% 0.18 105)",
			onAccent: "oklch(16% 0.02 80)",
		},
		light: {
			sky: {
				night: { l: 0.96, c: 0.02, h: 95 },
				top: { l: 0.92, c: 0.06, h: 100 },
				upper: { l: 0.87, c: 0.1, h: 85 },
				middle: { l: 0.8, c: 0.14, h: 60 },
				glow: { l: 0.88, c: 0.17, h: 100 },
			},
			accent: "oklch(86% 0.18 100)",
			onAccent: "oklch(16% 0.02 80)",
		},
	},
	// Bonk: a warm, loud yellow and orange, at night or in full sun.
	bonk: {
		name: "Bonk",
		dark: {
			sky: {
				night: { l: 0.12, c: 0.01, h: 60 },
				top: { l: 0.18, c: 0.03, h: 60 },
				upper: { l: 0.26, c: 0.06, h: 60 },
				middle: { l: 0.38, c: 0.11, h: 60 },
				glow: { l: 0.74, c: 0.18, h: 65 },
			},
			accent: "oklch(78% 0.17 70)",
			onAccent: "oklch(16% 0.03 60)",
		},
		light: {
			sky: {
				night: { l: 0.95, c: 0.03, h: 90 },
				top: { l: 0.9, c: 0.08, h: 88 },
				upper: { l: 0.86, c: 0.13, h: 80 },
				middle: { l: 0.8, c: 0.15, h: 65 },
				glow: { l: 0.74, c: 0.18, h: 55 },
			},
			accent: "oklch(72% 0.18 55)",
			onAccent: "oklch(16% 0.03 60)",
		},
	},
} as const satisfies Record<string, Brand>;

export type BrandId = keyof typeof BRANDS;
export type Theme = "dark" | "light" | "system" | "dynamic" | BrandId | `${BrandId}-light`;
export type Mode = "dark" | "light";

/** The plain themes, then one entry per team: its light look is picked beside it. */
export const THEMES: { id: Theme; name: string }[] = [
	{ id: "dark", name: "Dark" },
	{ id: "light", name: "Light" },
	{ id: "system", name: "System" },
	{ id: "dynamic", name: "Dynamic" },
	...(Object.entries(BRANDS) as [BrandId, Brand][]).map(([id, brand]) => ({
		id,
		name: brand.name,
	})),
];

/** Which team a theme is after, and in which mode, or nothing for the plain themes. */
export function brandOf(theme: Theme): (Look & { id: BrandId; mode: Mode }) | undefined {
	const light = theme.endsWith("-light");
	const id = (light ? theme.slice(0, -"-light".length) : theme) as BrandId;
	if (!(id in BRANDS)) return undefined;
	const mode: Mode = light ? "light" : "dark";
	return { id, mode, ...BRANDS[id][mode] };
}

const KEY = "maschina.theme";
const CHANGED = "maschina:theme";

export function themeFrom(saved: string | null): Theme {
	// Club was renamed Helius: a browser that chose it keeps it.
	if (saved === "club") return "helius";
	if (saved === null) return "dark";
	const known = THEMES.some((each) => each.id === saved) || brandOf(saved as Theme) !== undefined;
	return known ? (saved as Theme) : "dark";
}

/** Light or dark, for a theme, given the computer's setting and the hour (0 to 24, fractional). */
export function modeOf(
	theme: Theme,
	{ systemDark, hour }: { systemDark: boolean; hour: number },
): Mode {
	if (theme === "system") return systemDark ? "dark" : "light";
	if (theme === "dynamic") return skyAt(hour).night.l > 0.6 ? "light" : "dark";
	const brand = brandOf(theme);
	if (brand) return brand.mode;
	return theme as Mode;
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
		sky: theme === "dynamic" ? skyAt(hour) : brandOf(theme)?.sky,
	};
}
