/**
 * The frame every screen sits in: the sidebar, and where a page goes.
 *
 * The account control is the only live thing in here. Everything else navigates or will.
 */

import {
	CaretDown,
	CaretUpDown,
	ClockCounterClockwise,
	CurrencyDollar,
	DotsThree,
	GlobeHemisphereWest,
	MagnifyingGlass,
	Plus,
	Pulse,
	SidebarSimple,
	Sliders,
	Star,
	Storefront,
	UsersThree,
	Vault,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type ComponentType, useState } from "react";
import { useSession, useSignIn, useSignOut } from "../lib/session.ts";
import { LogoMark } from "./brand.tsx";

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

function IconButton({
	icon: Glyph,
	label,
	onClick,
}: {
	icon: ComponentType<{ size?: number; weight?: "regular" }>;
	label: string;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<Glyph size={18} weight="regular" />
		</button>
	);
}

function Group({
	name,
	action,
	children,
}: {
	name: string;
	action: string;
	children?: React.ReactNode;
}) {
	const [open, setOpen] = useState(true);

	return (
		<div className="mb-4">
			<div className="group flex h-7 items-center justify-between px-2">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className="flex items-center gap-1 text-[12px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
				>
					{name}
					<CaretDown
						size={11}
						weight="bold"
						className={`text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 ${
							open ? "" : "-rotate-90"
						}`}
					/>
				</button>
				<div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						aria-label={`${name} options`}
						className="text-muted-foreground/50 transition-colors hover:text-foreground"
					>
						<DotsThree size={16} weight="bold" />
					</button>
					<button
						type="button"
						aria-label={action}
						className="text-muted-foreground/50 transition-colors hover:text-foreground"
					>
						<Plus size={13} weight="bold" />
					</button>
				</div>
			</div>
			{open ? <div className="mt-1 space-y-1">{children}</div> : null}
		</div>
	);
}

function NavItem({
	label,
	icon: Glyph,
	items,
}: {
	label: string;
	icon: ComponentType<{ size?: number; className?: string }>;
	/** When present, pressing this opens them underneath rather than going anywhere. */
	items?: string[];
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={items ? () => setOpen(!open) : undefined}
				className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<Glyph size={16} className="shrink-0 opacity-80" />
				{label}
				{items ? (
					<CaretDown
						size={10}
						weight="bold"
						className={`ml-auto text-muted-foreground/40 transition-transform ${
							open ? "" : "-rotate-90"
						}`}
					/>
				) : null}
			</button>
			{items && open
				? items.map((item) => (
						<button
							key={item}
							type="button"
							className="flex h-8 w-full items-center rounded-lg py-0 pr-2 pl-[42px] text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							{item}
						</button>
					))
				: null}
		</>
	);
}

export function Shell({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(true);

	return (
		<div className="flex min-h-dvh bg-background text-foreground">
			{open ? null : (
				<div className="sticky top-0 flex h-12 items-center p-2.5">
					<IconButton icon={SidebarSimple} label="Show sidebar" onClick={() => setOpen(true)} />
				</div>
			)}
			<aside
				className={`sticky top-0 h-dvh w-[232px] shrink-0 flex-col border-border/60 border-r ${
					open ? "flex" : "hidden"
				}`}
			>
				<div className="flex h-12 items-center justify-between px-2.5 pt-3">
					<span className="pl-2">
						<LogoMark className="size-[18px]" />
					</span>
					<IconButton icon={SidebarSimple} label="Hide sidebar" onClick={() => setOpen(false)} />
				</div>

				<div className="px-2.5 pt-3 pb-2">
					<button
						type="button"
						className="flex h-8 w-full items-center gap-2.5 rounded-lg bg-muted/40 px-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<MagnifyingGlass size={16} className="shrink-0 opacity-80" />
						Search
						<span className="ml-auto font-mono text-[10px] text-muted-foreground/50">⌘K</span>
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto px-2.5 pb-2">
					<div className="mb-4 space-y-1">
						<NavItem label="New machine" icon={Plus} />
						<NavItem label="Activity" icon={Pulse} />
						<NavItem label="Runs" icon={ClockCounterClockwise} items={["Queued", "Finished"]} />
						<NavItem label="Marketplace" icon={Storefront} items={["Browse", "My listings"]} />
					</div>

					<Group name="Machines" action="New machine">
						<p className="px-2 py-1 text-[12px] text-muted-foreground/40">No machines yet</p>
						<NavItem label="Teams" icon={UsersThree} items={["All teams", "New team"]} />
					</Group>

					<Group name="Money" action="Add funds">
						<NavItem label="Wallet" icon={CurrencyDollar} items={["Balance", "Withdrawals"]} />
						<NavItem label="Stake" icon={Vault} />
					</Group>

					<Group name="Discover" action="Browse">
						<NavItem label="Network" icon={GlobeHemisphereWest} items={["Nodes", "Run a node"]} />
						<NavItem label="Creators" icon={Star} />
					</Group>

					<Group name="Account" action="New key">
						<NavItem label="Settings" icon={Sliders} items={["Alerts", "API keys", "Sessions"]} />
					</Group>
				</nav>

				<div className="mt-auto px-2.5 pt-1 pb-2">
					<AccountButton />
				</div>
			</aside>
			<main className="min-w-0 flex-1">{children}</main>
		</div>
	);
}

function AccountButton() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);
	const signOut = useSignOut(api, queryClient);

	if (session.data) {
		return (
			<button
				type="button"
				onClick={() => signOut.mutate()}
				className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-muted"
			>
				<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-[9px]">
					{session.data.walletAddress.slice(0, 2)}
				</span>
				<span className="min-w-0 flex-1 truncate font-mono text-[12px]">
					{short(session.data.walletAddress)}
				</span>
				<CaretUpDown size={14} className="shrink-0 text-muted-foreground/60" />
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => signIn.mutate()}
			disabled={signIn.isPending}
			className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-muted"
		>
			<span className="size-5 shrink-0 rounded-full bg-muted" />
			<span className="min-w-0 flex-1 truncate">
				{signIn.isPending ? "Check your wallet" : "Connect wallet"}
			</span>
		</button>
	);
}
