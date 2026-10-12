import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marquee } from "./marquee.tsx";

const NAMES = ["Solana", "Jupiter", "Turnkey", "Helius", "Cloudflare", "PostgreSQL"];
const nameOf = (item: Element) => item.querySelector("img")?.getAttribute("alt");
const section = () => screen.getByRole("region", { name: "Built With" });

describe("the marquee", () => {
	it("says what it is, Built with, and lists the tech Maschina really runs on, in order, once each for a reader", () => {
		render(<Marquee />);
		expect(within(section()).getByText("Built with")).toBeInTheDocument();
		const list = within(section()).getByRole("list");
		expect(within(list).getAllByRole("listitem").map(nameOf)).toEqual(NAMES);
	});

	it("repeats the names a second time so the loop has no gap, and hides that copy from assistive technology", () => {
		const { container } = render(<Marquee />);
		const copies = container.querySelectorAll("[data-copy]");
		expect(copies).toHaveLength(2);
		expect(copies[0]).not.toHaveAttribute("aria-hidden");
		expect(copies[1]).toHaveAttribute("aria-hidden", "true");
		// The copy is hidden, so its pictures say nothing a second time, and they are the same pictures in the same order.
		const files = (copy?: Element) =>
			[...(copy?.querySelectorAll("img") ?? [])].map((image) => image.getAttribute("src"));
		expect(files(copies[1])).toEqual(files(copies[0]));
		for (const image of copies[1]?.querySelectorAll("img") ?? [])
			expect(image).toHaveAttribute("alt", "");
	});

	it("slides slowly and steadily to the left, stops under the mouse, and does not move at all for anyone who asked for less motion", () => {
		const { container } = render(<Marquee />);
		const track = container.querySelector("[data-track]") as HTMLElement;
		expect(track.className).toContain("animate-marquee");
		expect(track.className).toContain("motion-reduce:animate-none");
		expect(track.className).toContain("hover:[animation-play-state:paused]");
		// With no motion the second copy would only repeat the first, so it goes.
		expect((container.querySelectorAll("[data-copy]")[1] as HTMLElement).className).toContain(
			"motion-reduce:hidden",
		);
		expect(track.className).toContain("motion-reduce:flex-wrap");
		expect(track.className).toContain("motion-reduce:justify-center");
	});

	it("fades out toward both edges, and fills the width between the page margins", () => {
		const { container } = render(<Marquee />);
		const frame = container.querySelector("[data-frame]") as HTMLElement;
		expect(frame.className).toContain("overflow-hidden");
		expect(frame.className).toMatch(/mask-image:linear-gradient\(to_right,transparent/);
		expect(section().className).toContain("px-(--gutter)");
		expect(section().className).toContain("bg-black");
	});

	it("shows each one's own mark as a picture, with its own file for each", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		const images = [...first.querySelectorAll("img")];
		expect(images.map((image) => image.getAttribute("src"))).toEqual(
			NAMES.map((name) => `/brand/stack/${name.toLowerCase()}.svg`),
		);
		for (const image of images) {
			expect(image).toHaveAttribute("height");
			expect(image).toHaveAttribute("width");
			expect(image).toHaveAttribute("decoding", "async");
		}
	});

	it("sets the name beside a mark that is only a symbol, and nothing beside a mark that already spells the name", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		const withWord = [...first.querySelectorAll("li")]
			.filter((item) => item.querySelector("[data-word]"))
			.map(nameOf);
		// Solana's file already spells its name; Turnkey and Helius too.
		expect(withWord).toEqual(["Jupiter", "Cloudflare", "PostgreSQL"]);
	});

	it("shows each company's own file, unmodified: Solana's gradient and wordmark, Helius's red, Cloudflare's orange, PostgreSQL's blue", () => {
		const read = (name: string) =>
			readFileSync(
				resolve(dirname(fileURLToPath(import.meta.url)), `../public/brand/stack/${name}.svg`),
				"utf8",
			);
		for (const name of NAMES) expect(read(name.toLowerCase()), name).toMatch(/^<svg/);
		expect(read("solana")).toContain("#9945FF");
		expect(read("solana")).toContain("#19FB9B");
		expect(read("helius")).toContain("#E84125");
		expect(read("cloudflare")).toContain("#F38020");
		expect(read("postgresql")).toContain("#4169E1");
	});

	it("shows them gray and dim until you look at them, then in their own colors, unchanged, by a filter and not by editing the file", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		for (const image of first.querySelectorAll("img")) {
			for (const part of [
				"grayscale",
				"brightness-",
				"opacity-60",
				"hover:grayscale-0",
				"hover:opacity-100",
			])
				expect(image.className, image.getAttribute("alt") ?? "").toContain(part);
		}
	});

	it("is not a list of partners: no link, no claim, just what it is built with", () => {
		const { container } = render(<Marquee />);
		expect(container.querySelector("a")).toBeNull();
		expect(section().textContent ?? "").not.toMatch(
			/partner|trusted by|backed by|official|endorse/i,
		);
	});

	it("brightens the typed name with its mark, so the two light up together", () => {
		const { container } = render(<Marquee />);
		const first = container.querySelector("[data-copy]") as HTMLElement;
		const words = first.querySelectorAll("[data-word]");
		expect(words).toHaveLength(3);
		for (const word of words) {
			expect(word.className).toContain("group-hover:text-white");
			expect(word.closest("li")?.className).toContain("group");
		}
	});
});
