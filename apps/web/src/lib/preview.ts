/**
 * Preview switches for trying things that are not finished: ?weather=rain, ?hour=18.5, ?toasts, ?break.
 * They work while developing and do nothing in the built app, so nobody on the live site can trip them.
 */
export function preview(name: string): string | undefined {
	if (!import.meta.env.DEV) return undefined;
	return new URLSearchParams(window.location.search).get(name) ?? undefined;
}
