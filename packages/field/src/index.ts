/**
 * The field: what moves behind the glass in every Maschina surface (the app, the front pages, the deck).
 * The fog and its backgrounds, the glass and grain over them, the towers, and the helper that turns a theme
 * color into one the charting library can read.
 */

export { rgbaOf } from "./chart-tone.ts";
export { cityTint, FogBackground, fogCanvas, type Mode, type Palette } from "./fog-background.tsx";
export { FoggedGlass, Grain } from "./fogged-glass.tsx";
export { CLEAR, type Field, type Motion, type Tower, type Weather } from "./types.ts";
