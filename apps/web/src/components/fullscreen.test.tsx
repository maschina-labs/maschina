import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Fullscreen } from "./fullscreen.tsx";

describe("full screen", () => {
	it("asks the browser to fill the screen with what it wraps", () => {
		const request = vi.fn(async () => undefined);
		HTMLElement.prototype.requestFullscreen = request;
		render(
			<Fullscreen label="Chart">
				<p>the chart</p>
			</Fullscreen>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Chart full screen" }));
		expect(request).toHaveBeenCalledOnce();
	});
});
