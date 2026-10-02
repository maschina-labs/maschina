import { Link, useRouterState } from "@tanstack/react-router";

/** Every section, in order. The one you are on is white; the rest are grey. */
export const SECTIONS = [
	{ to: "/", label: "Home" },
	{ to: "/insights", label: "Insights" },
	{ to: "/portfolio", label: "Portfolio" },
	{ to: "/machines", label: "Machines" },
	{ to: "/activity", label: "Activity" },
	{ to: "/swap", label: "Swap" },
	{ to: "/marketplace", label: "Marketplace" },
	{ to: "/network", label: "Network" },
] as const;

/** Whether a path is in a section. Home is the root, so it is only current when nothing deeper is. */
const isIn = (path: string, to: string) =>
	to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);

/**
 * On a desktop, a row of words over the tiles. On a phone, only the name of the page you are on; every
 * section is in the menu, and swiping the tiles moves between them.
 */
export function Sections() {
	const path = useRouterState({ select: (state) => state.location.pathname });
	const at = Math.max(
		SECTIONS.findIndex((section) => isIn(path, section.to)),
		0,
	);
	return (
		<>
			<nav
				aria-label="Sections"
				className="hidden items-center justify-between gap-8 font-display text-[15px] md:flex"
			>
				{SECTIONS.map((section, index) => (
					<Link
						key={section.to}
						to={section.to}
						aria-current={index === at ? "page" : undefined}
						className={`transition-colors duration-300 ${index === at ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}
					>
						{section.label}
					</Link>
				))}
			</nav>
			{/* On a phone, just the name of the page you are on; the menu holds the rest. */}
			<h1 className="font-display text-[30px] text-white leading-none md:hidden">
				{SECTIONS[at]?.label}
			</h1>
		</>
	);
}
