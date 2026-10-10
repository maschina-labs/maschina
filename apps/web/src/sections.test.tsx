import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Customize, Features, HowItWorks, Safety } from "./sections.tsx";

const AUTH = "https://auth.maschina.dev";

const SECTIONS = [
	{
		name: "How it works",
		title: "Give a machine a wallet and a job.",
		element: <HowItWorks authUrl={AUTH} />,
		links: [
			["Make a machine", `${AUTH}/sign-up`],
			["Read the docs", "https://docs.maschina.dev"],
		],
	},
	{
		name: "Inside the app",
		title: "See every move it makes.",
		element: <Features authUrl={AUTH} />,
		links: [["Try it on paper", `${AUTH}/sign-up`]],
	},
	{
		name: "Safety",
		title: "It cannot take your money.",
		element: <Safety />,
		links: [["Read how it is built", "https://docs.maschina.dev"]],
	},
	{
		name: "Customize",
		title: "Make it yours.",
		element: <Customize authUrl={AUTH} />,
		links: [["Make a machine", `${AUTH}/sign-up`]],
	},
] as const;

describe.each(SECTIONS)("the $name section", ({ name, title, element, links }) => {
	it("is a centered section with the pearl headline and the thin outline, one gray line, and its buttons", () => {
		render(element);
		const section = screen.getByRole("region", { name });
		const heading = within(section).getByRole("heading", { level: 2, name: title });
		for (const part of [
			"text-center",
			"bg-clip-text",
			"text-transparent",
			"[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]",
			"pb-[0.14em]",
			"-mb-[0.14em]",
		])
			expect(heading.className).toContain(part);
		const lines = section.querySelectorAll("p");
		expect(lines).toHaveLength(1);
		expect(lines[0]?.className).toContain("text-neutral-400");
		expect(lines[0]?.className).toContain("text-center");
		const anchors = within(section).getAllByRole("link");
		expect(anchors).toHaveLength(links.length);
		for (const [index, [label, href]] of links.entries()) {
			expect(anchors[index]).toHaveAccessibleName(label);
			expect(anchors[index]).toHaveAttribute("href", href);
		}
		// The first button is the pearl one; a second is the gray one, like the hero's.
		expect(anchors[0]?.className).toContain("bg-[oklch(0.93_0.02_300)]");
		if (links.length > 1) expect(anchors[1]?.className).toContain("bg-white/[0.13]");
	});

	it("is on black between the page margins, square and still, and claims nothing that is not true", () => {
		const { container } = render(element);
		const section = screen.getByRole("region", { name });
		expect(section.className).toContain("bg-black");
		expect(section.className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded|animate-|<canvas|<img/);
		expect(section.textContent ?? "").not.toMatch(
			/audit|users|customers|profit|return|guarantee|insured|open source|\bsdk\b|\bany\b/i,
		);
	});
});

describe("the sections' words", () => {
	it("say only what is built: limits and kinds of machine exist, rearranging your own screens is coming", () => {
		render(<Customize authUrl={AUTH} />);
		expect(screen.getByRole("region", { name: "Customize" }).textContent).toMatch(/coming soon/i);
	});
});
