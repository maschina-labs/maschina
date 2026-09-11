import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names, with later Tailwind utilities beating earlier ones.
 *
 * Without the merge, `cn("p-2", "p-4")` emits both and the winner depends on the
 * order Tailwind happened to generate them in, which is not something a component
 * author can reason about. This is the one utility every copied component expects
 * to exist, so it lives here rather than in each of them.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
