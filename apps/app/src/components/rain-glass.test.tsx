import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Made = {
	background: unknown;
	canvas: HTMLCanvasElement;
	started: boolean;
	running: boolean;
	finishStart: () => void;
};
const made = vi.hoisted(() => [] as Made[]);
vi.mock("raindrop-fx", () => ({
	default: class {
		entry: Made;
		constructor(options: { background: unknown; canvas: HTMLCanvasElement }) {
			// Starting takes a while, as the real one's does while it loads its textures.
			let finish = () => {};
			this.entry = {
				background: options.background,
				canvas: options.canvas,
				started: false,
				running: false,
				finishStart: () => finish(),
			};
			const entry = this.entry;
			made.push(entry);
			this.start = () =>
				new Promise<void>((done) => {
					finish = () => {
						entry.started = true;
						// Like the real one, its loop begins once started, whether or not stop came first.
						entry.running = true;
						done();
					};
				});
		}
		start: () => Promise<void>;
		stop() {
			this.entry.running = false;
		}
		resize() {}
		setBackground() {
			return Promise.resolve();
		}
	},
}));

const { fogCanvas } = await import("@maschina/field");
const { RainGlass } = await import("./rain-glass.tsx");

describe("rain on the glass", () => {
	it("follows the city to a new canvas when the theme makes one, never holding the old", async () => {
		made.length = 0;
		const first = document.body.appendChild(document.createElement("canvas"));
		fogCanvas.current = first;
		render(<RainGlass rain="drizzle" />);
		await vi.waitFor(() => expect(made.at(-1)?.background).toBe(first));
		// Switching themes builds the city again, on a new canvas, and takes the old one away.
		first.remove();
		const second = document.body.appendChild(document.createElement("canvas"));
		fogCanvas.current = second;
		await vi.waitFor(() => expect(made.at(-1)?.background).toBe(second), { timeout: 2000 });
	});

	it("gives every glass its own canvas, so two can never draw over each other in one", async () => {
		made.length = 0;
		const first = document.body.appendChild(document.createElement("canvas"));
		fogCanvas.current = first;
		const { container } = render(<RainGlass rain="rain" />);
		await vi.waitFor(() => expect(made).toHaveLength(1));
		// The theme changes while the first glass is still starting.
		first.remove();
		fogCanvas.current = document.body.appendChild(document.createElement("canvas"));
		await vi.waitFor(() => expect(made).toHaveLength(2), { timeout: 2000 });
		const [old, now] = made as [Made, Made];
		expect(now.canvas).not.toBe(old.canvas);
		// The old glass's canvas leaves the page, and only the new one is there.
		expect(old.canvas.isConnected).toBe(false);
		expect(container.querySelectorAll("canvas")).toHaveLength(1);
		// The first finishes starting after it was replaced: it must not be left running.
		old.finishStart();
		now.finishStart();
		await vi.waitFor(() => expect(old.started).toBe(true));
		expect(old.running).toBe(false);
		expect(now.running).toBe(true);
	});
});
