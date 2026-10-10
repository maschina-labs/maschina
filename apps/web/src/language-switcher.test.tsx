import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLanguage } from "./i18n/language.ts";
import { LocaleContext } from "./i18n/locale-context.tsx";
import { LanguageSwitcher } from "./language-switcher.tsx";

function clear() {
	for (const cookie of document.cookie.split("; ")) {
		const name = cookie.split("=")[0];
		// biome-ignore lint/suspicious/noDocumentCookie: a test clearing its own cookies, with no Cookie Store API in jsdom
		if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
	}
}
beforeEach(clear);
afterEach(clear);

const open = () => fireEvent.click(screen.getByRole("button", { name: "Language" }));
const option = (name: string) =>
	within(screen.getByRole("listbox"))
		.getAllByRole("option")
		.find((node) => node.querySelector("[data-name]")?.textContent === name) as HTMLElement;

describe("the language switcher", () => {
	it("lists every language on the list, English first, each under its own name", () => {
		render(<LanguageSwitcher />);
		open();
		const names = within(screen.getByRole("listbox"))
			.getAllByRole("option")
			.map((node) => node.querySelector("[data-name]")?.textContent);
		expect(names).toHaveLength(23);
		expect(names[0]).toBe("English");
		expect(names).toContain("繁體中文");
	});

	it("dims the languages that are not ready and tags them Soon, and pressing one changes nothing", () => {
		const navigate = vi.fn();
		render(<LanguageSwitcher available={["en"]} navigate={navigate} />);
		open();
		const spanish = option("Español");
		expect(spanish).toHaveAttribute("aria-disabled", "true");
		expect(spanish).toHaveTextContent("Soon");
		expect(option("English")).not.toHaveAttribute("aria-disabled");
		fireEvent.click(spanish);
		expect(navigate).not.toHaveBeenCalled();
		expect(readLanguage()).toBeNull();
		expect(screen.getByRole("listbox")).toBeInTheDocument();
	});

	it("takes the visitor to the same page in the language they pick, and remembers it", () => {
		const navigate = vi.fn();
		window.history.pushState({}, "", "/terms?x=1#liability");
		render(<LanguageSwitcher available={["en", "es"]} navigate={navigate} />);
		open();
		expect(option("Español")).not.toHaveAttribute("aria-disabled");
		fireEvent.click(option("Español"));
		expect(readLanguage()).toBe("es");
		expect(navigate).toHaveBeenCalledWith("/es/terms?x=1#liability");
		window.history.pushState({}, "", "/");
	});

	it("takes a visitor in a translated page back to English when they choose English, and remembers that they chose it", () => {
		const navigate = vi.fn();
		window.history.pushState({}, "", "/es/terms");
		render(
			<LocaleContext.Provider value="es">
				<LanguageSwitcher available={["en", "es"]} navigate={navigate} />
			</LocaleContext.Provider>,
		);
		const button = screen.getByRole("button", { name: "Language" });
		expect(button).toHaveTextContent("ES");
		open();
		expect(option("Español")).toHaveAttribute("aria-selected", "true");
		fireEvent.click(option("English"));
		// Choosing English is a choice, and it is kept, so no browser setting can undo it.
		expect(readLanguage()).toBe("en");
		expect(navigate).toHaveBeenCalledWith("/terms");
		window.history.pushState({}, "", "/");
	});

	it("shows the code of the language of the page, not of anything else", async () => {
		render(
			<LocaleContext.Provider value="ar">
				<LanguageSwitcher available={["en", "ar"]} navigate={() => {}} />
			</LocaleContext.Provider>,
		);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("AR"),
		);
	});
});
