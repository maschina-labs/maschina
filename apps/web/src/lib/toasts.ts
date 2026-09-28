import { useSyncExternalStore } from "react";

/**
 * Short lines that tell you what just happened, anywhere in the app. Kept outside React so any action can
 * raise one; each fades after a few seconds.
 */

export type Toast = { id: number; text: string; tone: "done" | "problem" };

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = () => {
	for (const listener of listeners) listener();
};

export function toast(text: string, tone: Toast["tone"] = "done", lastsMs = 4_000): void {
	const id = next++;
	toasts = [...toasts, { id, text: text.toUpperCase(), tone }];
	emit();
	setTimeout(() => {
		toasts = toasts.filter((each) => each.id !== id);
		emit();
	}, lastsMs);
}

export function useToasts(): Toast[] {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => toasts,
	);
}
