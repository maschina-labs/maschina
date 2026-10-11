import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * What each address is called, longest address first so a deeper page is named before the section around it. The
 * names are the ones the app's own menus use, in Title Case like every page name on Maschina.
 */
const NAMES: [prefix: string, name: string][] = [
	["/network/join", "Join the Network"],
	["/network/", "Node"],
	["/network", "Network"],
	["/marketplace/", "Listing"],
	["/marketplace", "Marketplace"],
	["/machines/", "Machine"],
	["/machines", "Machines"],
	["/m/", "Machine"],
	["/teams/", "Team"],
	["/teams", "Teams"],
	["/u/", "Profile"],
	["/wallet/stake", "Stake"],
	["/wallet", "Wallet"],
	["/settings/keys", "Keys"],
	["/settings/alerts", "Alerts"],
	["/settings", "Settings"],
	["/legal/terms", "Terms"],
	["/legal/privacy", "Privacy"],
	["/news", "News"],
	["/market/sol", "SOL Market"],
	["/get-a-wallet", "Get a Wallet"],
	["/sign-in", "Sign In"],
	["/new", "New Machine"],
	["/insights", "Insights"],
	["/portfolio", "Portfolio"],
	["/activity", "Activity"],
	["/swap", "Swap"],
	["/decisions", "Decisions"],
	["/trades", "Trades"],
	["/profit", "Profit"],
	["/manager", "Manager"],
	["/fleet", "Fleet"],
	["/feed", "Feed"],
	["/vault", "Vault"],
	["/invite", "Invite"],
	["/feedback", "Feedback"],
	["/welcome", "Welcome"],
	["/maintenance", "Maintenance"],
];

/** What the browser tab says: the page, then Maschina, like every other Maschina site. */
export function tabTitle(path: string): string {
	if (path === "/") return "Home | Maschina";
	const found = NAMES.find(([prefix]) =>
		prefix.endsWith("/")
			? path.startsWith(prefix)
			: path === prefix || path.startsWith(`${prefix}/`),
	);
	return found ? `${found[1]} | Maschina` : "Maschina";
}

export function TabTitle() {
	const path = useRouterState({ select: (state) => state.location.pathname });
	useEffect(() => {
		document.title = tabTitle(path);
	}, [path]);
	return null;
}
