import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { ChatPanel } from "./chat-panel.tsx";
import { GLASS } from "./glass.ts";
import { LeftRail, RightRail } from "./rails.tsx";
import { ScrollArea } from "./scroll-ticks.tsx";
import { Sections } from "./sections.tsx";
import { StatusBar } from "./status-bar.tsx";
import { WalletButton } from "./wallet-button.tsx";

/**
 * The terminal's frame: square glass panels over the fog, with thin gutters between them. No borders
 * and no shadows: the glass is only a lighter, blurred patch of the light behind it.
 */

export function Frame({ children, sides = true }: { children: ReactNode; sides?: boolean }) {
	const [chatting, setChatting] = useState(false);
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
				<div className="ml-auto flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => setChatting((was) => !was)}
						aria-pressed={chatting}
						className="inline-flex h-7 items-center bg-[oklch(1_0_0/0.08)] px-3.5 text-[10.5px] text-neutral-200 uppercase tracking-[0.14em] transition-colors hover:bg-[oklch(1_0_0/0.14)]"
					>
						Chat
					</button>
					<WalletButton />
				</div>
			</header>
			<div className="flex min-h-0 flex-1 gap-1.5">
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
			{chatting ? <ChatPanel onClose={() => setChatting(false)} /> : null}
		</div>
	);
}
