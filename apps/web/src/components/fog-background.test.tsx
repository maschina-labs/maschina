import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// A test browser has no WebGL, so the canvas is stood in for. What is tested is the frame around it:
// hidden from screen readers, never catching a click, and painting the gradient before the shader starts.
vi.mock("@react-three/fiber", () => ({
	Canvas: () => <canvas />,
	useFrame: () => undefined,
	useThree: () => ({ width: 1, height: 1 }),
}));

const { FogBackground, paletteName } = await import("./fog-background.tsx");

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
});

describe("choosing the fog's palette", () => {
	it("takes the one in the address, then the one remembered, then city", () => {
		expect(paletteName("?fog=ember", "ink")).toBe("ember");
		expect(paletteName("", "ink")).toBe("ink");
		expect(paletteName("?fog=nonsense", null)).toBe("city");
	});
});
