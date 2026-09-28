import { List, X } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SECTIONS } from "./sections.tsx";

/**
 * On a phone the header has no room for the nav, the rail or the sidebars, so one button opens a sheet
 * with every page. Rendered at the top of the page so the header's glass cannot trap it.
 */
export function MobileMenu() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				aria-label={open ? "Close menu" : "Menu"}
				aria-expanded={open}
				onClick={() => setOpen((was) => !was)}
				className="ml-3 grid size-8 place-items-center text-neutral-300 md:hidden"
			>
				{open ? <X size={18} weight="light" /> : <List size={18} weight="light" />}
			</button>
			{open
				? createPortal(
						<nav
							aria-label="Menu"
							className="fixed inset-x-1.5 top-14 bottom-9 z-40 flex flex-col gap-1 overflow-y-auto bg-black/85 p-4 backdrop-saturate-0 md:hidden"
						>
							{[...SECTIONS, { to: "/settings", label: "Settings" }].map((section) => (
								<Link
									key={section.to}
									to={section.to}
									onClick={() => setOpen(false)}
									activeOptions={{ exact: section.to === "/" }}
									className="border-white/[0.06] border-b py-4 text-[13px] text-neutral-400 uppercase tracking-[0.14em]"
									activeProps={{ className: "text-neutral-100" }}
								>
									{section.label}
								</Link>
							))}
						</nav>,
						document.body,
					)
				: null}
		</>
	);
}
