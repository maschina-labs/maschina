/**
 * The typed client for the gateway. Its types come straight from the gateway's routes, so a change
 * there that breaks the web app fails the typecheck here instead of in production.
 */

import type { AppType } from "@maschina/gateway";
import { hc } from "hono/client";

export type Api = ReturnType<typeof hc<AppType>>;

export function createApi(baseUrl: string, fetchFn: typeof fetch = fetch): Api {
	return hc<AppType>(baseUrl, {
		fetch: fetchFn,
		init: { credentials: "include" },
	});
}
