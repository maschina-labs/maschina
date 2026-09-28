import { GearSix } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { GLASS, GLASS_ACTIVE } from "./glass.ts";

/**
 * A thin rail down the right edge, like the activity bar in VS Code: as wide as the header is tall, in
 * the same glass. Icons go here for the things that are not pages of their own: settings for now, then
 * the wallet, docs and alerts. Settings sits at the bottom, where people look for it.
 */
export function IconRail() {
	return (
		<nav
			aria-label="Tools"
			className={`hidden w-11 shrink-0 flex-col items-center py-1.5 md:flex ${GLASS}`}
		>
			<div className="flex-1" />
			<Link
				to="/settings"
				aria-label="Settings"
				title="Settings"
				className="grid size-9 place-items-center text-neutral-500 transition-colors hover:text-neutral-100"
				activeProps={{ className: `text-neutral-100 ${GLASS_ACTIVE}` }}
			>
				<GearSix size={18} weight="light" />
			</Link>
		</nav>
	);
}
