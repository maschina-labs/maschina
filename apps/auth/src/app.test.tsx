import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthApp, PAGES } from "./app.tsx";

describe("the sign in pages", () => {
	it("has a page for every step a person can be sent to, including the one from the email's link", () => {
		expect(PAGES.map((page) => page.path)).toEqual([
			"/sign-in",
			"/sign-up",
			"/forgot",
			"/reset",
			"/verified",
		]);
	});

	it.each(PAGES)(
		"$path is a blank black page named $name, and the tab says so",
		({ path, name }) => {
			render(<AuthApp path={path} />);
			const page = screen.getByRole("main", { name });
			expect(page).toBeEmptyDOMElement();
			expect(page.className).toContain("bg-black");
			expect(document.title).toBe(`${name} | Maschina`);
		},
	);

	it("is Sign In for the front address and for any address nobody has heard of", () => {
		for (const path of ["/", "/nowhere"]) {
			const { unmount } = render(<AuthApp path={path} />);
			expect(document.title).toBe("Sign In | Maschina");
			unmount();
		}
	});

	it("ignores a trailing slash", () => {
		render(<AuthApp path="/sign-up/" />);
		expect(document.title).toBe("Sign Up | Maschina");
	});
});
