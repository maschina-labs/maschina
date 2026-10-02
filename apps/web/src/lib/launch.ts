/**
 * Where a detail screen was opened from: the tile's place on the screen, so the screen can grow out of
 * that tile as it opens and back into it as it closes, as a phone opens an app from its icon. Nothing
 * at all when a screen was opened from a link, and it settles in from the centre instead.
 */

export type Origin = { left: number; top: number; width: number; height: number };

let origin: Origin | undefined;

export function launchFrom(rect: Origin) {
	origin = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** The tile the screen came out of, read once by the screen that opens. */
export function takeOrigin(): Origin | undefined {
	const taken = origin;
	origin = undefined;
	return taken;
}

/**
 * The transform that puts a full-screen layer exactly over a tile, as the first frame of the zoom.
 * Without a tile, just short of full size at the centre.
 */
export function tileTransform(
	from: Origin | undefined,
	screen: { width: number; height: number },
): string {
	if (!from) return "translate3d(0, 0, 0) scale(0.97)";
	const dx = from.left + from.width / 2 - screen.width / 2;
	const dy = from.top + from.height / 2 - screen.height / 2;
	const sx = from.width / screen.width;
	const sy = from.height / screen.height;
	return `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
}
