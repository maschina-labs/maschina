import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Customize,
	Features,
	HowItWorks,
	LiveRecord,
	Marketplace,
	Network,
	Safety,
} from "./sections.tsx";

const AUTH = "https://auth.maschina.dev";
const DOCS = "https://docs.maschina.dev";

beforeEach(() => {
	// The globe asks for its map: stand one in, so no test reaches the network.
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("{}", { status: 500 })),
	);
});

const SECTIONS = [
	{
		name: "How It Works",
		title: "Give a machine a wallet and a job.",
		element: <HowItWorks authUrl={AUTH} />,
		links: [
			["Make a machine", `${AUTH}/sign-up`],
			["Read the docs", DOCS],
		],
	},
	{
		name: "Inside the App",
		title: "See every move it makes.",
		element: <Features authUrl={AUTH} />,
		links: [["Try it on paper", `${AUTH}/sign-up`]],
	},
	{
		name: "Safety",
		title: "The limits are yours.",
		element: <Safety />,
		links: [
			["risk disclosure", "/risk"],
			["Read how it is built", DOCS],
		],
	},
	{
		name: "Customize",
		title: "Make it yours.",
		element: <Customize authUrl={AUTH} />,
		links: [["Make a machine", `${AUTH}/sign-up`]],
	},
	{
		name: "Live Record",
		title: "Every decision, on the record.",
		element: <LiveRecord />,
		links: [],
	},
	{
		name: "Network",
		title: "A network of computers, running machines.",
		element: <Network />,
		links: [],
	},
	{
		name: "Marketplace",
		title: "Publish what works. Copy what does.",
		element: <Marketplace />,
		links: [],
	},
] as const;

describe.each(SECTIONS)("the $name section", ({ name, title, element, links }) => {
	it("is a left-aligned chapter with the pearl headline and the thin outline, and one gray line under it", () => {
		render(element);
		const section = screen.getByRole("region", { name });
		const heading = within(section).getByRole("heading", { level: 2, name: title });
		for (const part of [
			"text-left",
			"bg-clip-text",
			"text-transparent",
			"[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]",
			"pb-[0.14em]",
			"-mb-[0.14em]",
		])
			expect(heading.className).toContain(part);
		const line = heading.nextElementSibling as HTMLElement;
		expect(line.tagName).toBe("P");
		expect(line.className).toContain("text-neutral-400");
		expect(line.className).toContain("text-left");
		// Reading, not ceremony: nothing in the head is centered.
		expect(heading.className).not.toContain("text-center");
		expect(line.className).not.toContain("text-center");
	});

	it("has the buttons and links it should, and the first button is the pearl one", () => {
		render(element);
		const section = screen.getByRole("region", { name });
		const anchors = within(section).queryAllByRole("link");
		expect(anchors).toHaveLength(links.length);
		for (const [index, [label, href]] of links.entries()) {
			expect(anchors[index]).toHaveAccessibleName(label);
			expect(anchors[index]).toHaveAttribute("href", href);
		}
		const buttons = anchors.filter((link) => link.className.includes("bg-[oklch(0.93_0.02_300)]"));
		if (links.some(([label]) => label !== "risk disclosure"))
			expect(buttons.length).toBeGreaterThan(0);
	});

	it("is on black between the page margins, with room above and below that is smaller on a phone, square and still", () => {
		const { container } = render(element);
		const section = screen.getByRole("region", { name });
		expect(section.className).toContain("bg-black");
		expect(section.className).toContain("px-(--gutter)");
		expect(section.className).toContain("py-20");
		expect(section.className).toContain("sm:py-32");
		expect(container.innerHTML).not.toMatch(/rounded|animate-|<canvas|<img/);
	});

	it("claims nothing that is not true: no users, no customers, no returns, no promise, no audit it has not had", () => {
		render(element);
		const words = screen.getByRole("region", { name }).textContent ?? "";
		expect(words).not.toMatch(
			/\busers\b|customers|profit|returns|guarantee|insured|open source|\d+%|\$\d/i,
		);
		expect(words).not.toMatch(/audited by|has been audited|fully audited/i);
	});
});

describe("how it works", () => {
	it("has three steps, in order, one under the other beside the words, numbered 01 to 03", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		const steps = [...container.querySelectorAll("[data-step]")];
		expect(steps).toHaveLength(3);
		expect(steps.map((step) => step.querySelector("h3")?.textContent)).toEqual([
			"Pick a kind",
			"Set its limits",
			"Let it work",
		]);
		expect(steps.map((step) => step.querySelector("span")?.textContent)).toEqual([
			"01",
			"02",
			"03",
		]);
		const list = steps[0]?.parentElement as HTMLElement;
		expect(list.className).not.toMatch(/grid-cols-3/);
	});
});

describe("inside the app", () => {
	it("shows four tiles, two across from a small screen up and one on a phone, and says the pictures are samples", () => {
		const { container } = render(<Features authUrl={AUTH} />);
		expect(
			[...container.querySelectorAll("[data-tile] h3")].map((node) => node.textContent),
		).toEqual(["Portfolio", "Decisions", "Manager", "Record"]);
		const tile = container.querySelector("[data-tile]") as HTMLElement;
		expect((tile.parentElement as HTMLElement).className).toContain("sm:grid-cols-2");
		expect(screen.getByText("Sample data.")).toBeInTheDocument();
	});
});

describe("safety", () => {
	it("draws the path of an action in four steps, lists what is kept true, and says plainly it is not independently audited", () => {
		const { container } = render(<Safety />);
		expect(
			[...container.querySelectorAll("[data-flow]")].map((node) =>
				node.textContent?.replace(/^\d/, ""),
			),
		).toEqual(["The AI proposes", "Your limits check it", "The signer signs", "Solana settles it"]);
		expect(container.querySelectorAll("[data-point]")).toHaveLength(4);
		expect(screen.getByText(/has not been independently audited/)).toBeInTheDocument();
		expect(container.textContent).toMatch(/never holds your own wallet's keys/);
	});

	it("never says a wallet can only pay its owner", () => {
		const { container } = render(<Safety />);
		expect(container.textContent).not.toMatch(/only pay|can only ever pay|holds no keys/i);
	});
});

describe("customize", () => {
	it("shows the four settings a machine has, and says rearranging your own screens is coming soon", () => {
		const { container } = render(<Customize authUrl={AUTH} />);
		expect(
			[...container.querySelectorAll("[data-setting] span")].map((node) => node.textContent),
		).toEqual(["Range", "Floor", "Amount per trade", "Daily limit"]);
		expect(screen.getByRole("region", { name: "Customize" }).textContent).toMatch(/coming soon/i);
	});
});

describe("what is not built yet says so", () => {
	it.each([
		["Live Record", <LiveRecord key="l" />],
		["Network", <Network key="n" />],
		["Marketplace", <Marketplace key="m" />],
	])("%s is tagged Coming soon, and has no link to a page that does not exist", (name, element) => {
		const { container } = render(element);
		expect(container.querySelector("[data-tag]")).toHaveTextContent("Coming soon");
		expect(within(screen.getByRole("region", { name })).queryAllByRole("link")).toHaveLength(0);
	});

	it("the live record is a sample, and says it is not open yet", () => {
		const { container } = render(<LiveRecord />);
		expect(container.querySelectorAll("[data-row]")).toHaveLength(4);
		expect(screen.getByText("Sample data. The live record is not open yet.")).toBeInTheDocument();
	});

	it("the network has a globe a reader who cannot see it is told about", async () => {
		render(<Network />);
		// The globe loads in a piece of its own, which a slow or busy machine takes longer than a second to fetch.
		expect(
			await screen.findByRole(
				"img",
				{ name: "The network, on a turning globe" },
				{ timeout: 10_000 },
			),
		).toBeInTheDocument();
	});

	it("the marketplace shows three empty places, three across from a tablet up and one on a phone", () => {
		const { container } = render(<Marketplace />);
		const cards = container.querySelectorAll("[data-card]");
		expect(cards).toHaveLength(3);
		const first = cards[0] as HTMLElement;
		expect((first.parentElement as HTMLElement).className).toContain("md:grid-cols-3");
	});
});

describe("the chapters between the preview and the questions", () => {
	const side = (name: string, element: React.ReactElement) => {
		render(element);
		return screen
			.getByRole("region", { name })
			.querySelector("[data-chapter]") as HTMLElement | null;
	};

	it.each([
		["How It Works", <HowItWorks key="a" authUrl={AUTH} />],
		["Inside the App", <Features key="b" authUrl={AUTH} />],
		["Safety", <Safety key="c" />],
		["Customize", <Customize key="d" authUrl={AUTH} />],
		["Live Record", <LiveRecord key="e" />],
		["Network", <Network key="f" />],
	])(
		"%s puts its words and its visual in two columns from a large screen up, one under the other on a phone",
		(name, element) => {
			const chapter = side(name, element);
			expect(chapter).not.toBeNull();
			expect(chapter?.className).toContain("lg:grid-cols-2");
			expect(chapter?.querySelector("[data-words]")).not.toBeNull();
			expect(chapter?.querySelector("[data-visual]")).not.toBeNull();
			// The words come first in reading order, so a phone and a screen reader meet them before the picture.
			expect(chapter?.firstElementChild).toHaveAttribute("data-words");
		},
	);

	it("moves the visual from one side to the other down the page, so the headlines keep one left edge and the page keeps a rhythm", () => {
		const flipped: string[] = [];
		for (const [name, element] of [
			["How It Works", <HowItWorks key="a" authUrl={AUTH} />],
			["Inside the App", <Features key="b" authUrl={AUTH} />],
			["Safety", <Safety key="c" />],
			["Customize", <Customize key="d" authUrl={AUTH} />],
			["Live Record", <LiveRecord key="e" />],
			["Network", <Network key="f" />],
		] as const) {
			const { unmount } = render(element);
			const visual = screen
				.getByRole("region", { name })
				.querySelector("[data-visual]") as HTMLElement;
			if (visual.className.includes("lg:order-first")) flipped.push(name);
			unmount();
		}
		expect(flipped).toEqual(["Inside the App", "Customize", "Network"]);
	});

	it("keeps the marketplace's three places under a left-aligned head, since they are a row and not a picture", () => {
		const chapter = side("Marketplace", <Marketplace />);
		expect(chapter).toBeNull();
		expect(screen.getAllByRole("listitem")).toHaveLength(3);
	});
});
