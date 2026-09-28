import { Link } from "@tanstack/react-router";

/** Every page, as a row of text in the header. The one you are on is bright. */
export const SECTIONS = [
	{ to: "/", label: "Terminal" },
	{ to: "/portfolio", label: "Portfolio" },
	{ to: "/machines", label: "Machines" },
	{ to: "/activity", label: "Activity" },
	{ to: "/swap", label: "Swap" },
	{ to: "/marketplace", label: "Marketplace" },
	{ to: "/network", label: "Network" },
] as const;

export function Sections() {
	return (
		<nav aria-label="Sections" className="flex items-center gap-6 text-[10.5px] tracking-[0.14em]">
			{SECTIONS.map((section) => (
				<Link
					key={section.to}
					to={section.to}
					// Terminal is the root, so it is only current when nothing deeper is.
					activeOptions={{ exact: section.to === "/" }}
					className="text-neutral-500 uppercase transition-colors hover:text-neutral-200"
					activeProps={{ className: "text-neutral-100" }}
				>
					{section.label}
				</Link>
			))}
		</nav>
	);
}
