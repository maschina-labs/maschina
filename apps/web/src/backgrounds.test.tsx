import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Mesh, Particles } from "./backgrounds.tsx";

describe("the section backgrounds", () => {
	it("draws a mesh of soft gradients with plain CSS: no canvas, nothing that moves", () => {
		const { container } = render(<Mesh tone="pearl" />);
		const mesh = container.firstElementChild as HTMLElement;
		expect(mesh.className.match(/radial-gradient\(/g)?.length).toBeGreaterThanOrEqual(3);
		expect(container.querySelector("canvas")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-/);
	});

	it("gives the two tones different colors", () => {
		const a = render(<Mesh tone="pearl" />).container.innerHTML;
		const b = render(<Mesh tone="silver" />).container.innerHTML;
		expect(a).not.toBe(b);
	});

	it("draws sparse particles on one small canvas, and survives a browser with no canvas at all", () => {
		const { container } = render(<Particles />);
		expect(container.querySelector("canvas")).not.toBeNull();
	});
});
