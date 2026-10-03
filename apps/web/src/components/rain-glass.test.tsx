import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const made = vi.hoisted(() => [] as { background: unknown }[]);
vi.mock("raindrop-fx", () => ({
	default: class {
		constructor(options: { background: unknown }) {
			made.push(options);
		}
		start() {}
		stop() {}
		destroy() {}
		resize() {}
		setBackground() {
			return Promise.resolve();
		}
	},
}));

const { fogCanvas } = await import("./fog-background.tsx");
const { RainGlass } = await import("./rain-glass.tsx");

describe("rain on the glass", () => {
	it("follows the city to a new canvas when the theme makes one, never holding the old", async () => {
		const first = document.body.appendChild(document.createElement("canvas"));
		fogCanvas.current = first;
		render(<RainGlass rain="light" />);
		await vi.waitFor(() => expect(made.at(-1)?.background).toBe(first));
		// Switching themes builds the city again, on a new canvas, and takes the old one away.
		first.remove();
		const second = document.body.appendChild(document.createElement("canvas"));
		fogCanvas.current = second;
		await vi.waitFor(() => expect(made.at(-1)?.background).toBe(second), { timeout: 2000 });
	});
});
