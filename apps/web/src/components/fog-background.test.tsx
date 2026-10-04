import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// A test browser has no WebGL, so the canvas is stood in for. What is tested is the frame around it:
// hidden from screen readers, never catching a click, and painting the gradient before the shader starts.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));

const { FogBackground } = await import("./fog-background.tsx");

describe("the fog background", () => {
	it("is decoration only: hidden from assistive technology and never in the way of a click", () => {
		const { container } = render(<FogBackground />);
		const field = container.firstElementChild as HTMLElement;

		expect(field).toHaveAttribute("aria-hidden", "true");
		expect(field.className).toContain("pointer-events-none");
		expect(field.className).toContain("fixed");
	});

	it("paints the same gradient in CSS while the shader starts", () => {
		const { container } = render(<FogBackground />);

		expect((container.firstElementChild as HTMLElement).style.background).toContain("gradient");
	});

	it("can be confined to a panel instead of the whole screen", () => {
		const { container } = render(<FogBackground position="absolute" />);

		expect((container.firstElementChild as HTMLElement).className).toContain("absolute");
	});

	it("is the city with its color patches for our own themes, and ribbons of light for a tribute theme", () => {
		const city = render(<FogBackground />);
		expect((city.container.firstElementChild as HTMLElement).dataset["field"]).toBe("city");
		city.unmount();
		const ribbon = render(<FogBackground ribbon />);
		const field = ribbon.container.firstElementChild as HTMLElement;
		expect(field.dataset["field"]).toBe("ribbon");
		// Still the same fogged window: decoration only, never in the way.
		expect(field).toHaveAttribute("aria-hidden", "true");
		expect(field.className).toContain("pointer-events-none");
	});
});
