import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Builders } from "./builders.tsx";
import { Closing } from "./closing.tsx";
import { Hero } from "./hero.tsx";
import { Customize, Features, HowItWorks } from "./sections.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the buttons on the front page", () => {
	it("are as thick as the header's: 40 on a phone and a tablet, 32 on a desktop, every one of them", () => {
		const parts = [
			<Hero key="hero" authUrl={AUTH} />,
			<HowItWorks key="how" authUrl={AUTH} />,
			<Features key="features" authUrl={AUTH} />,
			<Customize key="customize" authUrl={AUTH} />,
			<Builders key="builders" />,
			<Closing key="closing" authUrl={AUTH} />,
		];
		let buttons = 0;
		for (const part of parts) {
			const { container, unmount } = render(part);
			for (const link of container.querySelectorAll("a")) {
				// A button is a link with a fill: the pearl and the gray ones. Plain text links are not.
				if (!/silver-button|bg-white\/\[0\.13\]/.test(link.className)) continue;
				buttons++;
				expect(link.className, link.textContent ?? "").toContain("h-10");
				expect(link.className, link.textContent ?? "").toContain("xl:h-8");
				expect(link.className).not.toContain("h-9");
			}
			unmount();
		}
		expect(buttons).toBeGreaterThanOrEqual(10);
		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});
});
