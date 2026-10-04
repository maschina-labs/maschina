/**
 * A team's ink: the whole text scale leaning toward the team's hue, so the words, numbers and charts in
 * every card belong to the theme and not only its buttons (Ash, 2026-10-04). Titles stay nearly white
 * (nearly black by day) with a breath of the hue; the quieter steps carry more of it. Lightness follows
 * the plain scale exactly, so contrast never changes. Maschina's own palette uses none of this.
 */

import type { Mode } from "./theme.ts";

export const INK_KEYS = [
	"--color-white",
	"--color-neutral-50",
	"--color-neutral-100",
	"--color-neutral-200",
	"--color-neutral-300",
	"--color-neutral-400",
	"--color-neutral-500",
	"--color-neutral-600",
	"--color-neutral-700",
	"--color-neutral-800",
	"--color-neutral-900",
	"--color-neutral-950",
] as const;

// Lightness of each step, the same as the plain scale in each mode (Tailwind's neutral by night, the
// turned-over scale in styles.css by day), and how much of the hue each step carries.
const DARK = [100, 98.5, 97, 92.2, 87, 70.8, 55.6, 43.9, 37.1, 26.9, 20.5, 14.5];
const LIGHT = [18, 14.5, 20.5, 26.9, 37.1, 38, 44, 52, 70, 92.2, 97, 98.5];
const CHROMA = [0.01, 0.01, 0.014, 0.02, 0.028, 0.04, 0.045, 0.04, 0.03, 0.02, 0.014, 0.01];

export function inkFor(hue: number, mode: Mode): Record<string, string> {
	const lightness = mode === "dark" ? DARK : LIGHT;
	const ink: Record<string, string> = {};
	INK_KEYS.forEach((key, index) => {
		ink[key] = `oklch(${lightness[index]}% ${CHROMA[index]} ${Math.round(hue)})`;
	});
	return ink;
}
