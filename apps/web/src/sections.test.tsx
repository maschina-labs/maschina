import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const DOCS = "/docs";

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
		const buttons = anchors.filter((link) => link.className.includes("silver-button"));
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
		// Square and still apart from the one slow drift of the light behind a chapter, which has its own test.
		expect(container.innerHTML.replace(/(motion-reduce:)?animate-(drift|none)/g, "")).not.toMatch(
			/rounded|animate-|<canvas|<img/,
		);
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
			const words = chapter?.querySelector("[data-words]") as HTMLElement;
			const visual = chapter?.querySelector("[data-visual]") as HTMLElement;
			expect(words.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe("the light behind the chapters", () => {
	it("gives each chapter a faint pearl glow on the side of its visual, with no color and no motion", () => {
		for (const [element, flip] of [
			[<HowItWorks key="a" authUrl={AUTH} />, false],
			[<Features key="b" authUrl={AUTH} />, true],
		] as const) {
			const { container, unmount } = render(element);
			const glow = container.querySelector("[data-glow]") as HTMLElement;
			expect(glow).not.toBeNull();
			expect(glow).toHaveAttribute("aria-hidden", "true");
			expect(glow.className).toContain("pointer-events-none");
			expect(glow.className).toContain(flip ? "left-" : "right-");
			// It drifts, slowly, and stops for anyone who has asked their device for less motion.
			expect(glow.className).toContain("animate-drift");
			expect(glow.className).toContain("motion-reduce:animate-none");
			// Pearl only: the page's own hue, never a bright color.
			expect(glow.className).toContain("oklch(0.93_0.02_300");
			unmount();
		}
	});
});

describe("the globe", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("does not load its map libraries until the network chapter is near the screen, so the page never pays for it on the way in", async () => {
		const watchers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
					watchers.push(callback);
				}
				observe() {}
				disconnect() {}
			},
		);
		const { container } = render(<Network />);
		expect(container.querySelector("[data-near]")).toHaveAttribute("data-near", "false");
		expect(container.querySelector("[aria-label]")).not.toBeNull();
		act(() => {
			for (const notify of watchers) notify([{ isIntersecting: true }]);
		});
		expect(container.querySelector("[data-near]")).toHaveAttribute("data-near", "true");
	});
});

describe("how a chapter arrives and what is behind it", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("shows at once when the browser cannot watch for scrolling, so nothing is ever hidden for good", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		expect(container.querySelector("[data-chapter]")).toHaveAttribute("data-seen", "true");
	});

	it("waits out of sight until it is scrolled to, then rises into place, words first and the visual a beat later", () => {
		let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
		const disconnect = vi.fn();
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: typeof notify) {
					notify = callback;
				}
				observe() {}
				disconnect = disconnect;
			},
		);
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		const chapter = container.querySelector("[data-chapter]") as HTMLElement;
		expect(chapter).toHaveAttribute("data-seen", "false");
		const words = chapter.querySelector("[data-words]") as HTMLElement;
		const visual = chapter.querySelector("[data-visual]") as HTMLElement;
		expect(words.className).toContain("group-data-[seen=false]/chapter:opacity-0");
		expect(words.className).toContain("motion-reduce:transition-none");
		expect(visual.className).toContain("delay-");
		act(() => notify([{ isIntersecting: true }]));
		expect(chapter).toHaveAttribute("data-seen", "true");
		// It arrives once: after that it stops watching, so scrolling back up never hides it again.
		expect(disconnect).toHaveBeenCalled();
	});

	it("has no line between the chapters: the space is the divider", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		expect(container.querySelector("[data-rule]")).toBeNull();
	});

	it("has no dot texture behind the visuals any more: it is under the cursor, on the cards, instead", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		expect(container.querySelector("[data-texture]")).toBeNull();
	});
});

describe("the dots under the cursor", () => {
	const cards = (container: HTMLElement) => [...container.querySelectorAll(".card-dots")];

	it("is on the cards of every chapter that has them, and on nothing else", () => {
		for (const [element, expected] of [
			[<HowItWorks key="a" authUrl={AUTH} />, 3],
			[<Features key="b" authUrl={AUTH} />, 4],
			[<Safety key="c" />, 4 + 4],
			[<Customize key="d" authUrl={AUTH} />, 1],
			[<LiveRecord key="e" />, 1],
			[<Marketplace key="f" />, 3],
		] as const) {
			const { container, unmount } = render(element);
			expect(cards(container), String(expected)).toHaveLength(expected);
			unmount();
		}
	});

	it("is not on the globe, where it looks wrong", () => {
		const { container } = render(<Network />);
		expect(cards(container)).toHaveLength(0);
		expect(container.innerHTML).not.toContain("card-dots");
	});

	it("follows the mouse across a card, in the card's own coordinates, and ignores a finger", () => {
		const { container } = render(<HowItWorks authUrl={AUTH} />);
		const card = cards(container)[0] as HTMLElement;
		card.getBoundingClientRect = () => ({ left: 100, top: 40, width: 300, height: 120 }) as DOMRect;
		fireEvent.pointerMove(card, { clientX: 160, clientY: 90 });
		expect(card.style.getPropertyValue("--mx")).toBe("60px");
		expect(card.style.getPropertyValue("--my")).toBe("50px");
		fireEvent.pointerMove(card, { clientX: 300, clientY: 60, pointerType: "touch" });
		expect(card.style.getPropertyValue("--mx")).toBe("60px");
	});

	it("is drawn by the stylesheet, only while the pointer is over the card and only where there is a pointer to hover with", () => {
		const css = readFileSync(
			resolve(dirname(fileURLToPath(import.meta.url)), "styles.css"),
			"utf8",
		);
		expect(css).toMatch(/\.card-dots::before/);
		expect(css).toMatch(/\.card-dots:hover::before/);
		expect(css).toContain("var(--mx");
		expect(css).toMatch(/@media \(hover: none\)/);
	});
});

describe("make it yours: the lines draw themselves", () => {
	it("draws each setting's line from left to right, one row after the next from the top, when the section arrives", () => {
		const { container } = render(<Customize authUrl={AUTH} />);
		const rows = [...container.querySelectorAll("[data-setting]")];
		expect(rows).toHaveLength(4);
		let before = -1;
		for (const row of rows) {
			const track = row.querySelector("[data-track]") as HTMLElement;
			const fill = row.querySelector("[data-fill]") as HTMLElement;
			for (const line of [track, fill]) {
				expect(line.className).toContain("origin-left");
				expect(line.className).toContain("group-data-[seen=false]/chapter:scale-x-0");
				expect(line.className).toContain("motion-reduce:transition-none");
			}
			// The track draws, then its fill follows, and each row starts after the one above it.
			const start = Number.parseInt(track.style.transitionDelay, 10);
			const follow = Number.parseInt(fill.style.transitionDelay, 10);
			expect(follow).toBeGreaterThan(start);
			expect(start).toBeGreaterThan(before);
			before = start;
		}
	});
});

describe("the chapters, with no chips", () => {
	it.each([
		["How It Works", <HowItWorks key="a" authUrl={AUTH} />],
		["Inside the App", <Features key="b" authUrl={AUTH} />],
		["Safety", <Safety key="c" />],
		["Customize", <Customize key="d" authUrl={AUTH} />],
		["Live Record", <LiveRecord key="e" />],
		["Network", <Network key="f" />],
		["Marketplace", <Marketplace key="g" />],
	])(
		"%s opens on its headline: the chapter chips were pulled, so nothing labels a section before it speaks",
		(name, element) => {
			render(element);
			const section = screen.getByRole("region", { name });
			expect(section.querySelector("[data-chip-tag]")).toBeNull();
			// The headline is the first thing in the words column, with nothing above it.
			const heading = within(section).getByRole("heading", { level: 2 });
			expect(heading.previousElementSibling).toBeNull();
		},
	);
});

describe("the chapters share the header's edges", () => {
	it.each([
		["How It Works", <HowItWorks key="a" authUrl={AUTH} />],
		["Inside the App", <Features key="b" authUrl={AUTH} />],
		["Safety", <Safety key="c" />],
		["Customize", <Customize key="d" authUrl={AUTH} />],
		["Live Record", <LiveRecord key="e" />],
		["Network", <Network key="f" />],
		["Marketplace", <Marketplace key="g" />],
	])(
		"%s fills the full width between the page margins, with no narrower cap of its own",
		(name, element) => {
			const { container } = render(element);
			const section = screen.getByRole("region", { name });
			expect(section.className).toContain("px-(--gutter)");
			for (const node of section.querySelectorAll("[data-chapter], [data-chapter] ~ *, ul, ol")) {
				expect((node as HTMLElement).className, name).not.toMatch(/max-w-\[(64|72)rem\]/);
			}
			expect(container.innerHTML, name).not.toMatch(/max-w-\[72rem\]/);
		},
	);
});
