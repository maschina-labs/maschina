import { ArrowLeft } from "@phosphor-icons/react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { takeOrigin, tileTransform } from "../lib/launch.ts";
import {
	FeedbackScreen,
	GetAWalletScreen,
	InviteScreen,
	PrivacyScreen,
	SignInScreen,
	StakeScreen,
	TermsScreen,
	WalletScreen,
	WelcomeScreen,
} from "./account-screens.tsx";
import { Bento, Tile } from "./bento.tsx";
import { MachineScreen } from "./machine-screen.tsx";
import { ManagerPage } from "./manager-page.tsx";
import {
	DecisionsScreen,
	FeedScreen,
	FleetScreen,
	ProfitScreen,
	SolScreen,
	TradesScreen,
	VaultScreen,
} from "./money-screens.tsx";
import { NewMachineScreen } from "./new-machine-screen.tsx";
import { PapersScreen } from "./papers-screen.tsx";
import {
	CreatorScreen,
	JoinScreen,
	ListingScreen,
	MaintenanceScreen,
	NodeScreen,
	PublicMachineScreen,
	TeamScreen,
	TeamsScreen,
} from "./place-screens.tsx";
import { Sections } from "./sections.tsx";
import { AlertsScreen, KeysScreen, SettingsScreen } from "./settings-screens.tsx";
import { NotFound } from "./system.tsx";

/**
 * The detail layer: anything opened from a section, a machine or settings or a new machine, grows out
 * of the tile it was opened from and fills the screen with glass, with the dashboard dimmed behind it
 * where you left it. Back or Escape fades it away. Opened from a link, it settles in
 * from the center. It has its own address.
 *
 * Inside it is the same grid as every section, so a machine's detail is its own set of tiles.
 */

/** How long the card takes to grow out of its tile, its content to fade in, and the whole to fade out. */
const GROW_MS = 460;
const FADE_MS = 140;
const CLOSE_MS = 260;

/** What a page is called at the top of the layer, from its address. */
export function titleFor(path: string): string {
	const named: [RegExp, string][] = [
		[/^\/market\/sol(\/|$)/, "SOL"],
		[/^\/profit(\/|$)/, "Profit"],
		[/^\/vault(\/|$)/, "Vault"],
		[/^\/fleet(\/|$)/, "Your machines"],
		[/^\/decisions(\/|$)/, "Decisions"],
		[/^\/trades(\/|$)/, "Trades"],
		[/^\/feed(\/|$)/, "Activity"],
		[/^\/machines\/[^/]+(\/|$)/, "Machine"],
		[/^\/m\/[^/]+(\/|$)/, "Machine"],
		[/^\/new(\/|$)/, "New machine"],
		[/^\/settings\/alerts(\/|$)/, "Alerts"],
		[/^\/settings\/keys(\/|$)/, "Keys"],
		[/^\/settings(\/|$)/, "Settings"],
		[/^\/wallet\/stake(\/|$)/, "Stake"],
		[/^\/wallet(\/|$)/, "Wallet"],
		[/^\/marketplace\/[^/]+(\/|$)/, "Listing"],
		[/^\/network\/join(\/|$)/, "Run a node"],
		[/^\/network\/[^/]+(\/|$)/, "Node"],
		[/^\/teams\/[^/]+(\/|$)/, "Team"],
		[/^\/teams(\/|$)/, "Teams"],
		[/^\/u\/[^/]+(\/|$)/, "Profile"],
		[/^\/manager(\/|$)/, "Manager"],
		[/^\/sign-in(\/|$)/, "Sign in"],
		[/^\/welcome(\/|$)/, "Welcome"],
		[/^\/papers(\/|$)/, "Papers"],
		[/^\/invite(\/|$)/, "Invite"],
		[/^\/feedback(\/|$)/, "Feedback"],
		[/^\/get-a-wallet(\/|$)/, "Get a wallet"],
		[/^\/legal\/terms(\/|$)/, "Terms"],
		[/^\/legal\/privacy(\/|$)/, "Privacy"],
		[/^\/maintenance(\/|$)/, "Maintenance"],
	];
	return named.find(([pattern]) => pattern.test(path))?.[1] ?? "Not found";
}

export function Detail({ back }: { back: string }) {
	const path = useRouterState({ select: (state) => state.location.pathname });
	const navigate = useNavigate();
	const router = useRouter();
	// The tile it came out of, if any, read once as it opens.
	const [origin] = useState(takeOrigin);
	/**
	 * The open, in steps, as a phone opens an app from its icon: a plain card grows out of the tile to
	 * fill the screen, and only once it has landed does the content fade in on it. Closing fades it all.
	 * Only the plain card ever moves, which is light work for the browser, so it stays smooth; the
	 * content, with its blur and its text, never stretches.
	 */
	const [phase, setPhase] = useState<"tile" | "growing" | "open" | "fading">("tile");

	useEffect(() => {
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setPhase("growing"));
		});
		const landed = setTimeout(() => setPhase("open"), GROW_MS);
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
			clearTimeout(landed);
		};
	}, []);

	// Back to where you came from when there is somewhere in the app to go back to; otherwise to the
	// section underneath, so a link opened fresh still has a way out.
	const leave = () => {
		if (window.history.state?.__TSR_index > 0) router.history.back();
		else void navigate({ to: back });
	};
	// Closing is a plain fade of the whole screen, quicker than the zoom in. Zooming back into the tile
	// put two near colors against each other as it shrank, and looked wrong.
	const close = () => {
		if (phase === "fading") return;
		setPhase("fading");
		setTimeout(leave, CLOSE_MS);
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const atTile = phase === "tile";
	const showing = phase === "open";
	const leaving = phase === "fading";
	const screen = { width: window.innerWidth, height: window.innerHeight };
	const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

	return (
		<div role="dialog" aria-label={titleFor(path)} className="fixed inset-0 z-20">
			{/* The dashboard dims behind it while it is open. */}
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-black/45"
				style={{
					opacity: atTile || leaving ? 0 : 1,
					transition: `opacity ${leaving ? CLOSE_MS : GROW_MS}ms ${EASE}`,
				}}
			/>
			{/* The card that grows: solid, nothing in it, so it moves cleanly. The opened screen is opaque. */}
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-(--surface-sheet) will-change-transform [transform-origin:center]"
				style={{
					transform: atTile ? tileTransform(origin, screen) : "none",
					opacity: leaving ? 0 : 1,
					transition: leaving ? `opacity ${CLOSE_MS}ms ${EASE}` : `transform ${GROW_MS}ms ${EASE}`,
				}}
			/>
			{/* The screen itself, faded in once the card has landed and out before it flips back. */}
			<div
				className="no-scrollbar relative h-full overflow-y-auto"
				style={{
					opacity: showing ? 1 : 0,
					transition: `opacity ${leaving ? CLOSE_MS : FADE_MS}ms ease-out`,
					pointerEvents: showing ? "auto" : "none",
				}}
			>
				<div className="flex justify-center px-5 pt-[max(env(safe-area-inset-top),24px)] pb-32 md:px-0 md:pt-[8vh] md:pb-10">
					<div className="w-full md:w-[calc(var(--u)*6+50px)] md:[--u:min(calc((86cqw-50px)/6),calc((66cqh-20px)/3))]">
						<header className="flex items-center gap-4">
							<button
								type="button"
								aria-label="Back"
								onClick={close}
								className="grid size-11 place-items-center bg-white/[0.11] text-neutral-100 transition-colors duration-300 hover:bg-white/[0.18] md:size-12"
							>
								<ArrowLeft size={22} weight="light" />
							</button>
							<h1 className="font-display font-normal text-[22px] text-neutral-100 leading-none tracking-[-0.01em] md:text-[clamp(26px,2.9vw,42px)]">
								{titleFor(path)}
							</h1>
						</header>
						{/*
						 * The sections row, held in place but unseen, so the grid below sits exactly where it sits
						 * on every main page. Its height is measured by the real thing, never guessed: a guess was
						 * off by up to eight pixels depending on the screen.
						 */}
						<div aria-hidden="true" className="invisible mt-9 mb-5 md:mt-[5vh] md:mb-3">
							<Sections />
						</div>
						{/* The manager is a conversation, not tiles: it takes the whole of the grid's room. */}
						{titleFor(path) === "Manager" ? (
							<ManagerPage />
						) : (
							<Bento label={titleFor(path)}>
								<DetailTiles path={path} />
							</Bento>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

/** What each screen holds. The ones not built yet show the empty grid. */
/**
 * The screens, by what each is called: the title list above is the one place an address is matched, and
 * it is tested, so a screen can never open at an address that only starts like its own.
 */
const SCREENS: Record<string, () => ReactNode> = {
	"New machine": () => <NewMachineScreen />,
	Papers: () => <PapersScreen />,
	Settings: () => <SettingsScreen />,
	Alerts: () => <AlertsScreen />,
	Keys: () => <KeysScreen />,
	Wallet: () => <WalletScreen />,
	Stake: () => <StakeScreen />,
	"Sign in": () => <SignInScreen />,
	Welcome: () => <WelcomeScreen />,
	"Get a wallet": () => <GetAWalletScreen />,
	Invite: () => <InviteScreen />,
	Feedback: () => <FeedbackScreen />,
	Terms: () => <TermsScreen />,
	Privacy: () => <PrivacyScreen />,
	Teams: () => <TeamsScreen />,
	Team: () => <TeamScreen />,
	Listing: () => <ListingScreen />,
	Node: () => <NodeScreen />,
	"Run a node": () => <JoinScreen />,
	Profile: () => <CreatorScreen />,
	Maintenance: () => <MaintenanceScreen />,
	Profit: () => <ProfitScreen />,
	Vault: () => <VaultScreen />,
	"Your machines": () => <FleetScreen />,
	Decisions: () => <DecisionsScreen />,
	Trades: () => <TradesScreen />,
	Activity: () => <FeedScreen />,
	SOL: () => <SolScreen />,
};

function DetailTiles({ path }: { path: string }) {
	const machine = /^\/machines\/([^/]+)/.exec(path)?.[1];
	if (machine) return <MachineScreen machineId={machine} />;
	// A shared link to a machine: its public page, which can show but never act.
	if (/^\/m\/[^/]+\/?$/.test(path)) return <PublicMachineScreen />;
	const title = titleFor(path);
	const screen = SCREENS[title];
	if (screen) return screen();
	if (title === "Not found") return <NotFound />;
	return (
		<>
			<Tile size="large" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
		</>
	);
}
