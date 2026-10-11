import { useEffect } from "react";

/**
 * Every address of the docs the site and its menus send people to. Each is a blank black page until it is written, but
 * it exists, so a link to it never lands on nothing, and its tab is named after it like every page on Maschina. The
 * Docs front page is first.
 */
export const PAGES = [
	{ path: "/", name: "Docs" },
	{ path: "/quickstart", name: "Quickstart" },
	{ path: "/api", name: "API" },
	{ path: "/sdk", name: "SDK" },
	{ path: "/machine-spec", name: "Machine Spec" },
	{ path: "/templates", name: "Templates" },
	{ path: "/examples", name: "Examples" },
] as const;

export function Site({ path }: { path: string }) {
	const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
	const name = PAGES.find((page) => page.path === clean)?.name ?? "Page Not Found";
	useEffect(() => {
		document.title = `${name} | Maschina`;
	}, [name]);
	return <main aria-label={name} className="min-h-dvh bg-black" />;
}
