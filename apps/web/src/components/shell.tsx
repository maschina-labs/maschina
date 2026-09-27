/**
 * The frame every screen sits in.
 *
 * A single column of navigation on the left and one outlet on the right. The sidebar is a list of places,
 * ordered the way somebody thinks about the product rather than the way the code is arranged: the thing
 * you make, the things it did, the things it did them with, the world around it, then you.
 *
 * Two rules hold it together. Nothing in here is coloured unless it is where you are, and the only thing
 * pinned to the bottom is the wallet, because signing in or out is the one action that is always relevant
 * and never part of a task.
 */

import {
	ArrowsLeftRight,
	CaretDown,
	CaretUpDown,
	ClockCounterClockwise,
	CurrencyDollar,
	GlobeHemisphereWest,
	type Icon,
	MagnifyingGlass,
	Plus,
	Pulse,
	SidebarSimple,
	SignOut,
	Sliders,
	Star,
	Storefront,
	UsersThree,
	Vault,
	Wallet,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useSession, useSignIn, useSignOut } from "../lib/session.ts";
import { LogoMark } from "./brand.tsx";
import { IconButton } from "./ui.tsx";

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/* ------------------------------------------------------------------ pieces */

type Item = {
	label: string;
	icon: Icon;
	to?: string;
	/**
	 * Pages this item is the home of, beyond its own address.
	 *
	 * Deliberately not "anything underneath my path". Wallet and Withdrawal are siblings in this list
	 * even though one address sits inside the other, and a parent lighting up for a page its sibling owns
	 * makes the sidebar say you are in two places at once.
	 */
	owns?: string;
	/** When present, pressing this opens them underneath rather than going anywhere. */
	under?: { label: string; to?: string }[];
};

function NavItem({ item, depth = 0 }: { item: Item; depth?: number }) {
	const [open, setOpen] = useState(false);
	const path = useRouterState({ select: (state) => state.location.pathname });
	const here =
		(item.to !== undefined && path === item.to) ||
		(item.owns !== undefined && path.startsWith(item.owns));
	const Glyph = item.icon;

	const shared =
		"flex h-[26px] w-full items-center gap-2 rounded-md pr-2 text-left text-[12.5px] transition-colors duration-150";
	const resting = here
		? "bg-accent-wash/70 text-text"
		: "text-text-muted hover:bg-muted hover:text-text";

	const body = (
		<>
			<Glyph size={14} className="shrink-0 text-current opacity-70" />
			<span className="truncate">{item.label}</span>
			{item.under ? (
				<CaretDown
					size={9}
					weight="bold"
					className={`ml-auto shrink-0 text-text-faint transition-transform duration-150 ${
						open ? "" : "-rotate-90"
					}`}
				/>
			) : null}
			{here && !item.under ? (
				<span className="ml-auto size-1 shrink-0 rounded-full bg-accent" />
			) : null}
		</>
	);

	return (
		<>
			{item.under ? (
				<button
					type="button"
					onClick={() => setOpen(!open)}
					aria-expanded={open}
					className={`${shared} ${resting}`}
					style={{ paddingLeft: `${8 + depth * 14}px` }}
				>
					{body}
				</button>
			) : item.to ? (
				<Link
					to={item.to}
					className={`${shared} ${resting}`}
					style={{ paddingLeft: `${8 + depth * 14}px` }}
				>
					{body}
				</Link>
			) : (
				<button
					type="button"
					className={`${shared} ${resting}`}
					style={{ paddingLeft: `${8 + depth * 14}px` }}
				>
					{body}
				</button>
			)}

			{item.under && open
				? item.under.map((child) =>
						child.to ? (
							<Link
								key={child.label}
								to={child.to}
								className="flex h-[26px] w-full items-center rounded-md pr-2 pl-[36px] text-left text-[12.5px] text-text-faint transition-colors duration-150 hover:bg-muted hover:text-text"
							>
								<span className="truncate">{child.label}</span>
							</Link>
						) : (
							<button
								key={child.label}
								type="button"
								className="flex h-[26px] w-full items-center rounded-md pr-2 pl-[36px] text-left text-[12.5px] text-text-faint transition-colors duration-150 hover:bg-muted hover:text-text"
							>
								<span className="truncate">{child.label}</span>
							</button>
						),
					)
				: null}
		</>
	);
}

/** A named group of places, foldable, with its name kept quiet. */
function Group({ name, children }: { name: string; children: ReactNode }) {
	const [open, setOpen] = useState(true);

	return (
		<div className="mt-4">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className="group flex h-6 w-full items-center gap-1 px-2 text-[10px] text-text-faint uppercase tracking-[0.1em] transition-colors duration-150 hover:text-text-muted"
			>
				{name}
				<CaretDown
					size={8}
					weight="bold"
					className={`opacity-0 transition-all duration-150 group-hover:opacity-100 ${
						open ? "" : "-rotate-90"
					}`}
				/>
			</button>
			{open ? <div className="mt-0.5 space-y-px">{children}</div> : null}
		</div>
	);
}

/* ------------------------------------------------------------------ shell */

export function Shell({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(true);

	return (
		<div className="flex min-h-dvh bg-background text-text">
			{open ? null : (
				<div className="sticky top-0 flex h-11 items-center px-2.5">
					<IconButton icon={SidebarSimple} label="Show sidebar" onClick={() => setOpen(true)} />
				</div>
			)}

			<aside
				className={`sticky top-0 h-dvh w-[214px] shrink-0 flex-col border-line border-r ${
					open ? "flex" : "hidden"
				}`}
			>
				<div className="flex h-11 items-center justify-between px-2.5">
					<Link
						to="/"
						className="flex items-center gap-1.5 rounded px-1 py-1"
						aria-label="Maschina"
					>
						<LogoMark className="size-[15px] text-text" />
						{/* The one place Söhne Breit appears. */}
						<span className="font-display font-semibold text-[12px] text-text tracking-[0.02em]">
							MASCHINA
						</span>
					</Link>
					<IconButton icon={SidebarSimple} label="Hide sidebar" onClick={() => setOpen(false)} />
				</div>

				<div className="px-2.5 pb-1">
					<button
						type="button"
						className="flex h-7 w-full items-center gap-2 rounded-md border border-line bg-inset px-2 text-left text-[12px] text-text-faint transition-colors duration-150 hover:border-line-strong hover:text-text-muted"
					>
						<MagnifyingGlass size={13} className="shrink-0" />
						Search
						<kbd className="ml-auto rounded border border-line px-1 font-mono text-[9px] text-text-faint">
							⌘K
						</kbd>
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto px-2.5 pb-3">
					<div className="mt-2 space-y-px">
						<NavItem item={{ label: "New machine", icon: Plus, to: "/new" }} />
						<NavItem item={{ label: "Activity", icon: Pulse, to: "/activity" }} />
						<NavItem
							item={{
								label: "Runs",
								icon: ClockCounterClockwise,
								under: [
									{ label: "Queued runs", to: "/runs/queued" },
									{ label: "Finished", to: "/runs/finished" },
								],
							}}
						/>
						<NavItem
							item={{
								label: "Marketplace",
								icon: Storefront,
								under: [
									{ label: "Browse marketplace", to: "/marketplace" },
									{ label: "My listings", to: "/marketplace/mine" },
								],
							}}
						/>
					</div>

					<Group name="Machines">
						<NavItem item={{ label: "All machines", icon: Pulse, to: "/", owns: "/machines/" }} />
						<NavItem
							item={{
								label: "Teams",
								icon: UsersThree,
								under: [{ label: "All teams" }, { label: "New team" }],
							}}
						/>
					</Group>

					<Group name="Money">
						<NavItem item={{ label: "Wallet", icon: Wallet, to: "/wallet" }} />
						<NavItem item={{ label: "Balance", icon: CurrencyDollar, to: "/wallet/balance" }} />
						<NavItem
							item={{ label: "Withdrawal", icon: ArrowsLeftRight, to: "/wallet/withdraw" }}
						/>
						<NavItem item={{ label: "Stake", icon: Vault }} />
					</Group>

					<Group name="Discover">
						<NavItem
							item={{
								label: "Network",
								icon: GlobeHemisphereWest,
								under: [{ label: "Nodes", to: "/network" }, { label: "Run a node" }],
							}}
						/>
						<NavItem item={{ label: "Creators", icon: Star }} />
					</Group>

					<Group name="Account">
						<NavItem
							item={{
								label: "Settings",
								icon: Sliders,
								under: [
									{ label: "Alerts" },
									{ label: "API keys", to: "/settings/keys" },
									{ label: "Sessions" },
								],
							}}
						/>
					</Group>
				</nav>

				<div className="mt-auto border-line border-t p-2.5">
					<AccountButton />
				</div>
			</aside>

			<main className="min-w-0 flex-1">{children}</main>
		</div>
	);
}

/**
 * The wallet, pinned to the bottom.
 *
 * Signed out it is the only filled control in the sidebar, because until it is pressed nothing else in
 * the product can do anything. Signed in it goes quiet and becomes an address.
 */
function AccountButton() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);
	const signOut = useSignOut(api, queryClient);

	if (session.data) {
		return (
			<div className="flex items-center gap-1">
				<button
					type="button"
					className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-150 hover:bg-muted"
				>
					<span className="flex size-5 shrink-0 items-center justify-center rounded border border-line bg-inset font-medium font-mono text-[9px] text-text-muted">
						{session.data.walletAddress.slice(0, 2)}
					</span>
					<span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text-muted">
						{short(session.data.walletAddress)}
					</span>
					<CaretUpDown size={12} className="shrink-0 text-text-faint" />
				</button>
				<IconButton
					icon={SignOut}
					label="Disconnect wallet"
					size={13}
					onClick={() => signOut.mutate()}
					disabled={signOut.isPending}
				/>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => signIn.mutate()}
			disabled={signIn.isPending}
			className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-accent px-2 font-medium text-[12px] text-[oklch(0.14_0.01_254)] transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
		>
			<Wallet size={13} />
			{signIn.isPending ? "Check your wallet" : "Connect wallet"}
		</button>
	);
}
