import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header.tsx";
import { PullToRefresh } from "./pull-refresh.tsx";
import { inShell, scroller } from "./shell.ts";

const SHELL = "(hover: none) and (pointer: coarse)";

function screenLike(options: { touch: boolean; reducedMotion?: boolean }) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches:
				query === SHELL
					? options.touch
					: query.includes("prefers-reduced-motion")
						? Boolean(options.reducedMotion)
						: false,
			addEventListener() {},
			removeEventListener() {},
		})),
	);
}

let root: HTMLDivElement;
beforeEach(() => {
	root = document.createElement("div");
	root.id = "root";
	document.body.appendChild(root);
});
afterEach(() => {
	root.remove();
	vi.unstubAllGlobals();
});

const touches = (y: number) => ({ touches: [{ clientY: y }], changedTouches: [{ clientY: y }] });

describe("the shell, which a touch screen scrolls inside of instead of the document", () => {
	it("is only for a touch screen: a mouse and a trackpad keep the ordinary page", () => {
		screenLike({ touch: false });
		expect(inShell()).toBe(false);
		expect(scroller()).toBe(window);
		screenLike({ touch: true });
		expect(inShell()).toBe(true);
		expect(scroller()).toBe(root);
	});

	it("is not there where there is no way to ask, as in an old browser", () => {
		vi.stubGlobal("matchMedia", undefined);
		expect(inShell()).toBe(false);
		expect(scroller()).toBe(window);
	});
});

describe("pull down to refresh, drawn by the page itself", () => {
	const content = () => screen.getByTestId("content");
	const setup = (options: { touch: boolean; reducedMotion?: boolean }, refresh = vi.fn()) => {
		screenLike(options);
		root.scrollTop = 0;
		render(
			<PullToRefresh refresh={refresh} className="page">
				<div data-testid="content" />
			</PullToRefresh>,
			{ container: root.appendChild(document.createElement("div")) },
		);
		return refresh;
	};

	it("does nothing on a screen with a mouse", () => {
		const refresh = setup({ touch: false });
		fireEvent.touchStart(root, touches(100));
		const move = fireEvent.touchMove(root, touches(260));
		fireEvent.touchEnd(root, touches(260));
		expect(move).toBe(true);
		expect(refresh).not.toHaveBeenCalled();
	});

	it("moves the whole page down with the finger, with some resistance and a limit, and holds the move so the browser's own bounce never starts", () => {
		setup({ touch: true });
		const page = content().parentElement as HTMLElement;
		fireEvent.touchStart(root, touches(100));
		const allowed = fireEvent.touchMove(root, touches(140));
		expect(allowed).toBe(false);
		expect(page.style.transform).toBe("translateY(20px)");
		fireEvent.touchMove(root, touches(900));
		expect(page.style.transform).toBe("translateY(96px)");
	});

	it("refreshes when pulled far enough and let go, and not when it is let go too early", () => {
		const refresh = setup({ touch: true });
		const page = content().parentElement as HTMLElement;
		fireEvent.touchStart(root, touches(100));
		fireEvent.touchMove(root, touches(160));
		fireEvent.touchEnd(root, touches(160));
		expect(refresh).not.toHaveBeenCalled();
		expect(page.style.transform).toBe("");

		fireEvent.touchStart(root, touches(100));
		fireEvent.touchMove(root, touches(260));
		fireEvent.touchEnd(root, touches(260));
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("shows ldrs' square loader above the page, in pearl, that grows into view as it is pulled", () => {
		setup({ touch: true });
		const loader = screen.getByTestId("loader");
		expect(loader).toHaveAttribute("aria-hidden", "true");
		expect(loader.style.opacity).toBe("0");
		// The square from ldrs: a square outline with a short bright stretch of it running round the track.
		const square = loader.querySelector("svg") as SVGElement;
		expect(square).not.toBeNull();
		expect(square.querySelectorAll("rect")).toHaveLength(2);
		expect(square.getAttribute("width")).toBe("28");
		const style = (square.parentElement as HTMLElement).getAttribute("style") ?? "";
		expect(style).toContain("--uib-color: oklch(0.93 0.02 300)");
		fireEvent.touchStart(root, touches(100));
		fireEvent.touchMove(root, touches(180));
		expect(Number(loader.style.opacity)).toBeGreaterThan(0.3);
		fireEvent.touchMove(root, touches(300));
		expect(loader.style.opacity).toBe("1");
	});

	it("does not start when the page is not at the top, so scrolling back up is just scrolling", () => {
		const refresh = setup({ touch: true });
		root.scrollTop = 300;
		fireEvent.touchStart(root, touches(100));
		const move = fireEvent.touchMove(root, touches(400));
		fireEvent.touchEnd(root, touches(400));
		expect(move).toBe(true);
		expect(refresh).not.toHaveBeenCalled();
		expect((content().parentElement as HTMLElement).style.transform).toBe("");
	});

	it("slides back with a soft ease, or at once for anyone who asked for less motion", () => {
		setup({ touch: true });
		const page = content().parentElement as HTMLElement;
		fireEvent.touchStart(root, touches(100));
		fireEvent.touchMove(root, touches(160));
		fireEvent.touchEnd(root, touches(160));
		expect(page.style.transition).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
		root.remove();
		root = document.createElement("div");
		root.id = "root";
		document.body.appendChild(root);
		setup({ touch: true, reducedMotion: true });
		const calm = screen.getAllByTestId("content").at(-1)?.parentElement as HTMLElement;
		fireEvent.touchStart(root, touches(100));
		fireEvent.touchMove(root, touches(160));
		fireEvent.touchEnd(root, touches(160));
		expect(calm.style.transition).toBe("none");
	});
});

describe("the header in the shell", () => {
	it("fades in as the root box scrolls, since the window no longer does", () => {
		screenLike({ touch: true });
		render(<Header authUrl="https://auth.maschina.dev" />, {
			container: root.appendChild(document.createElement("div")),
		});
		const fade = screen.getByRole("banner").querySelector("[data-fade]") as HTMLElement;
		expect(fade.style.getPropertyValue("--fade")).toBe("0");
		root.scrollTop = 4000;
		fireEvent.scroll(root);
		expect(fade.style.getPropertyValue("--fade")).toBe("1");
	});

	it("locks the root box, not the document, while a panel is open, and gives it back after", () => {
		screenLike({ touch: true });
		render(<Header authUrl="https://auth.maschina.dev" />, {
			container: root.appendChild(document.createElement("div")),
		});
		root.style.overflow = "auto";
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(root.style.overflow).toBe("hidden");
		expect(document.documentElement.style.overflow).not.toBe("hidden");
		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(root.style.overflow).toBe("auto");
	});
});
