/**
 * The few things the field needs to know about the app around it: what moves behind the glass, how much
 * it moves, the weather in the city, and the towers' machines. The app decides them; the field draws them.
 */

/** What moves behind the glass. */
export type Field = "mesh" | "ribbon" | "particles" | "towers";
/** How much the background moves: smoothly, calmly (a fraction of the work), or not at all. */
export type Motion = "full" | "calm" | "off";

type Rain = "none" | "drizzle" | "rain" | "heavy";

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

/** One of the owner's machines as a tower: how tall, and how brightly it glows. */
export type Tower = { height: number; glow: number };
