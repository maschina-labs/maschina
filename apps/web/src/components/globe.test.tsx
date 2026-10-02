import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Globe } from "./globe.tsx";

const topology = {
	type: "Topology",
	arcs: [
		[
			[0, 0],
			[10, 0],
			[0, 10],
			[-10, 0],
			[0, -10],
		],
	],
	objects: {
		countries: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[0]] }] },
	},
};

afterEach(() => vi.unstubAllGlobals());

describe("the globe", () => {
	it("draws the sphere and its dashed graticule, then the countries near and far once they arrive", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(topology))),
		);
		const { container } = render(<Globe />);

		expect(screen.getByRole("img", { name: /globe/ })).toBeInTheDocument();
		expect(container.querySelector("ellipse")).toBeNull();
		// The graticule near and far and the rim straight away; countries near and far once they load.
		expect(container.querySelectorAll("path")).toHaveLength(3);
		await waitFor(() => expect(container.querySelectorAll("path")).toHaveLength(5));
		expect(container.querySelector("path")).toHaveAttribute("stroke-dasharray", "2 4");
	});

	it("turns when dragged", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(topology))),
		);
		const { container } = render(<Globe />);
		const globe = screen.getByRole("img", { name: /globe/ });
		const grid = () => container.querySelector("path")?.getAttribute("d");
		// The test browser has no pointer capture.
		(globe as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

		const before = grid();
		fireEvent.pointerDown(globe, { clientX: 100, clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(globe, { clientX: 220, clientY: 140, pointerId: 1 });
		fireEvent.pointerUp(globe, { pointerId: 1 });

		expect(grid()).not.toBe(before);
	});

	it("turns on its own only while it can be seen", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(topology))),
		);
		const shown: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(report: (entries: { isIntersecting: boolean }[]) => void) {
					shown.push(report);
				}
				observe() {}
				disconnect() {}
			},
		);
		const frames = vi.spyOn(window, "requestAnimationFrame");
		const canceled = vi.spyOn(window, "cancelAnimationFrame");
		render(<Globe />);
		shown[0]?.([{ isIntersecting: true }]);
		await waitFor(() => expect(frames).toHaveBeenCalled());
		shown[0]?.([{ isIntersecting: false }]);
		expect(canceled).toHaveBeenCalled();
	});
});
