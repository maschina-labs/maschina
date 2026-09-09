/** The renderer's view of what preload exposed. Keep in step with preload/index.ts. */
import type { MaschinaApi } from "../preload/index.ts";

declare global {
	interface Window {
		/** Optional: absent if the preload failed to load, which must not crash the UI. */
		readonly maschina?: MaschinaApi;
	}
}
