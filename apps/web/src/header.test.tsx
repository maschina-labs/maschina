import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./header.tsx";

describe("the header", () => {
	it("is the wordmark, and it leads home", () => {
		render(<Header authUrl="https://auth.maschina.dev" />);
		const header = within(screen.getByRole("banner"));
		const home = header.getByRole("link", { name: "Maschina, home" });
		expect(home).toHaveAttribute("href", "/");
		expect(within(home).getByRole("img", { name: "Maschina" })).toHaveAttribute(
			"src",
			"/brand/wordmark.svg",
		);
	});

	it("leads to sign in and sign up, wherever auth lives", () => {
		render(<Header authUrl="http://localhost:3001" />);
		const header = within(screen.getByRole("banner"));
		expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"http://localhost:3001/sign-in",
		);
		expect(header.getByRole("link", { name: "Sign up" })).toHaveAttribute(
			"href",
			"http://localhost:3001/sign-up",
		);
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Header authUrl="https://auth.maschina.dev" />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
