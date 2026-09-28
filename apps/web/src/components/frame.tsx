import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GLASS } from "./glass.ts";
import { RightRail } from "./rails.tsx";
import { Sections } from "./sections.tsx";
import { StatusBar } from "./status-bar.tsx";
import { WalletButton } from "./wallet-button.tsx";

/**
 * The terminal's frame: square glass panels over the fog, with thin gutters between them. No borders
 * and no shadows: the glass is only a lighter, blurred patch of the light behind it.
 */

export function Frame({ children, sides = true }: { children: ReactNode; sides?: boolean }) {
	return (
		<div className="flex h-dvh flex-col gap-1.5 p-1.5">
			<header className={`sticky top-0 z-20 flex h-11 shrink-0 items-center px-4 ${GLASS}`}>
				{/* Set in type until the redrawn logo arrives. It always takes you home. */}
				<Link
					to="/"
					className="font-semibold font-wordmark text-[22px] text-neutral-100 tracking-normal"
				>
					MASCHINA
				</Link>
				{/* Left aligned, just after the wordmark. */}
				<div className="ml-10 hidden md:block">
					<Sections />
				</div>
				<div className="ml-auto">
					<WalletButton />
				</div>
			</header>
			<div className="flex min-h-0 flex-1 gap-1.5">
				<main className="min-w-0 flex-1 overflow-y-auto overscroll-none">{children}</main>
				{sides ? <RightRail /> : null}
			</div>
			<StatusBar />
		</div>
	);
}
