import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { openPalette } from "./command-palette.tsx";

/** A search box that is the command palette's front door: it looks like a field and opens ⌘K. */
export function SearchBox() {
	return (
		<button
			type="button"
			onClick={openPalette}
			className="hidden h-7 w-56 items-center gap-2.5 bg-[oklch(1_0_0/0.05)] px-3 text-[10.5px] text-neutral-500 tracking-[0.14em] transition-colors hover:bg-[oklch(1_0_0/0.09)] lg:flex"
		>
			<MagnifyingGlass size={12} weight="light" />
			<span className="flex-1 text-left">SEARCH</span>
			<span className="text-neutral-600">⌘K</span>
		</button>
	);
}

/** Making a machine, always one press away. */
export function NewMachineButton() {
	return (
		<Link
			to="/machines"
			aria-label="New machine"
			className="inline-flex h-7 items-center gap-1.5 bg-[oklch(1_0_0/0.08)] px-3 text-[10.5px] text-neutral-200 tracking-[0.14em] transition-colors hover:bg-[oklch(1_0_0/0.14)]"
		>
			<Plus size={11} weight="bold" />
			NEW
		</Link>
	);
}
