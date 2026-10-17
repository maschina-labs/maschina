/**
 * Where the record is read from.
 *
 * Set at build time, falling back to the deployed API. Without the fallback the app asked its own
 * origin, live.maschina.dev, which has no API on it: the Worker's single-page fallback answered the
 * page itself, 200 with HTML, and the record read it as unreadable. A page that is up, serving an
 * API that is up, showing nothing (MISTAKES M49).
 */
export const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";
