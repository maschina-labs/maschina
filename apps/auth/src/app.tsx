import { useEffect } from "react";

/**
 * Every step of signing in has a page, each blank until its design lands. The designs that were here before were
 * wiped on purpose (the last version is in git, at e893fbd); what they ran on is kept for the next one:
 * `people-api.ts` asks the gateway and puts its answers in words, and `next.ts` decides where a signed in person may
 * be sent. The tab is named after the page, in Title Case, like every page on Maschina.
 */
export const PAGES = [
	{ path: "/sign-in", name: "Sign In" },
	{ path: "/sign-up", name: "Sign Up" },
	{ path: "/forgot", name: "Forgot Password" },
	{ path: "/reset", name: "Reset Password" },
	{ path: "/verified", name: "Email Confirmed" },
] as const;

export function AuthApp({ path }: { path: string }) {
	const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
	const name = PAGES.find((page) => page.path === clean)?.name ?? "Sign In";
	useEffect(() => {
		document.title = `${name} | Maschina`;
	}, [name]);
	return <main aria-label={name} className="min-h-dvh bg-black" />;
}
