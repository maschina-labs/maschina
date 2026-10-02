import { useEffect, useState } from "react";
import { preview } from "./preview.ts";

/**
 * The weather outside, as the city and its window show it. The forecast comes from Open-Meteo: free,
 * no account, and it only ever learns a location rounded to about ten kilometres. Rain runs down the
 * glass; snow, cloud, fog and lightning happen in the city behind it.
 */

export type Rain = "none" | "drizzle" | "rain" | "heavy";

export type Weather = {
	rain: Rain;
	/** 0 none to 1 a blizzard. */
	snow: number;
	/** 0 clear to 1 overcast: the city's glow dims under it. */
	cloud: number;
	/** 0 clear to 1 thick: the city goes further away. */
	fog: number;
	lightning: boolean;
	hail: boolean;
};

export const CLEAR: Weather = {
	rain: "none",
	snow: 0,
	cloud: 0,
	fog: 0,
	lightning: false,
	hail: false,
};

/** The forecast's WMO weather code, as the city shows it. */
export function weatherOf(code: number): Weather {
	const with_ = (change: Partial<Weather>): Weather => ({ ...CLEAR, ...change });
	switch (code) {
		case 0:
			return CLEAR;
		case 1:
			return with_({ cloud: 0.15 });
		case 2:
			return with_({ cloud: 0.4 });
		case 3:
			return with_({ cloud: 0.8 });
		case 45:
		case 48:
			return with_({ cloud: 0.6, fog: 0.85 });
		case 51:
		case 53:
		case 56:
			return with_({ rain: "drizzle", cloud: 0.7 });
		case 55:
		case 57:
			return with_({ rain: "rain", cloud: 0.75 });
		case 61:
		case 80:
			return with_({ rain: "rain", cloud: 0.8 });
		case 63:
		case 81:
			return with_({ rain: "rain", cloud: 0.85 });
		case 65:
		case 66:
		case 67:
		case 82:
			return with_({ rain: "heavy", cloud: 0.9 });
		case 71:
		case 77:
			return with_({ snow: 0.3, cloud: 0.7 });
		case 73:
		case 85:
			return with_({ snow: 0.6, cloud: 0.8 });
		case 75:
		case 86:
			return with_({ snow: 1, cloud: 0.9 });
		case 95:
			return with_({ rain: "heavy", cloud: 1, lightning: true });
		case 96:
		case 99:
			return with_({ rain: "heavy", cloud: 1, lightning: true, hail: true });
		default:
			return CLEAR;
	}
}

/** The preview switch, ?weather=name, as a code to show. */
const NAMED: Record<string, number> = {
	clear: 0,
	cloudy: 2,
	overcast: 3,
	fog: 45,
	drizzle: 51,
	rain: 63,
	heavy: 65,
	snow: 73,
	blizzard: 75,
	storm: 95,
	hail: 99,
};

export function weatherFrom(name: string | null): Weather | undefined {
	const code = name ? NAMED[name] : undefined;
	return code === undefined ? undefined : weatherOf(code);
}

/** One decimal place of a degree is about eleven kilometres: enough for the weather, not for a street. */
export function roundedPlace(latitude: number, longitude: number) {
	return { latitude: Math.round(latitude * 10) / 10, longitude: Math.round(longitude * 10) / 10 };
}

/** How often the forecast is checked. Open-Meteo itself updates about every fifteen minutes. */
const EVERY_MS = 15 * 60_000;

// For reviewing: ?weather=rain and the rest hold the weather there. Read once at load, so moving between
// screens does not change it. Development only.
const ASKED = weatherFrom(preview("weather") ?? null);

async function forecast(latitude: number, longitude: number): Promise<Weather> {
	const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`The forecast answered ${response.status}`);
	const body = (await response.json()) as { current?: { weather_code?: number } };
	return weatherOf(body.current?.weather_code ?? 0);
}

/**
 * The weather where you are, while `on`. Asks the browser for a location once; if that is refused or
 * fails, it stays clear and the city carries on as it was.
 */
export function useWeather(on: boolean): Weather {
	const [weather, setWeather] = useState<Weather>(ASKED ?? CLEAR);
	useEffect(() => {
		if (!on || ASKED || !navigator.geolocation) return;
		let alive = true;
		let timer: ReturnType<typeof setInterval> | undefined;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				const place = roundedPlace(coords.latitude, coords.longitude);
				const check = () =>
					forecast(place.latitude, place.longitude)
						.then((now) => {
							if (alive) setWeather(now);
						})
						// A failed check keeps the last weather; the next one tries again.
						.catch(() => {});
				void check();
				timer = setInterval(check, EVERY_MS);
			},
			() => {},
			{ maximumAge: 60 * 60_000, timeout: 20_000 },
		);
		return () => {
			alive = false;
			if (timer) clearInterval(timer);
		};
	}, [on]);
	return ASKED ?? (on ? weather : CLEAR);
}
