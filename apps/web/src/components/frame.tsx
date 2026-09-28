import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GLASS } from "./glass.ts";
import { MobileMenu } from "./mobile-menu.tsx";
import { LeftRail, RightRail } from "./rails.tsx";
import { ScrollArea } from "./scroll-ticks.tsx";
import { Sections } from "./sections.tsx";
import { StatusBar } from "./status-bar.tsx";
import { WalletButton } from "./wallet-button.tsx";

/**
 * The terminal's frame, like JetBrains: a header, a left and a right rail of tools, and a status bar,
 * all attached to the edges and to each other, with no gaps and no lines between them.
 * The page sits in the middle, straight on the fog.
 */

export function Frame({ children, sides = true }: { children: ReactNode; sides?: boolean }) {
	return (
		<div className="flex h-dvh flex-col">
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
				<div className="ml-auto flex items-center gap-1.5">
					<WalletButton />
					<MobileMenu />
				</div>
			</header>
			<div className="flex min-h-0 flex-1">
				{sides ? <LeftRail /> : null}
				<main className="min-w-0 flex-1">
					<ScrollArea>
						{/* The page in a centred column, with the two sidebars either side. */}
						<div className="mx-auto h-full w-full max-w-[1100px]">{children}</div>
					</ScrollArea>
				</main>

				{sides ? <RightRail /> : null}
			</div>
			<StatusBar />
		</div>
	);
}
