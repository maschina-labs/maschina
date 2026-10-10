import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { en } from "./i18n/en.ts";
import { LocaleContext } from "./i18n/locale-context.tsx";
import { CATALOGS, type Messages } from "./i18n/messages.ts";
import { OPEN_PREFERENCES } from "./preferences.ts";
import { PreferencesToast } from "./preferences-toast.tsx";

const AUTH = "https://auth.maschina.dev";

/** A stand-in language for the test, with a few words changed, so the test shows the words come from the catalog. */
const pretend: Messages = {
	...structuredClone(en),
	labels: {
		...en.labels,
		Product: "Producto",
		Company: "Empresa",
		Papers: "Documentos",
		Legal: "Aviso legal",
		Terms: "Condiciones",
		Marketplace: "Mercado",
	},
	header: {
		...en.header,
		login: "Iniciar sesión",
		tryMaschina: "Probar Maschina",
		searchMaschina: "Buscar en Maschina",
		search: "Buscar",
		menu: "Menú",
		noMatch: "Ninguna página coincide.",
		soon: "Pronto",
	},
	footer: {
		...en.footer,
		sitemap: "Mapa del sitio",
		soon: "Pronto",
		rights: "© {year} Maschina Labs. Todos los derechos reservados.",
	},
	preferences: {
		...en.preferences,
		title: "Preferencias de cookies",
		accept: "Aceptar",
		decline: "Rechazar",
	},
};

beforeEach(() => {
	CATALOGS["es"] = pretend;
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => {
	delete CATALOGS["es"];
	vi.unstubAllGlobals();
});

const inSpanish = (node: React.ReactNode) =>
	render(<LocaleContext.Provider value="es">{node}</LocaleContext.Provider>);

describe("the footer in another language", () => {
	it("says its words in that language: the columns, the pages, the tag on what is not built, the rights line", () => {
		inSpanish(<Footer />);
		const nav = within(screen.getByRole("navigation", { name: "Mapa del sitio" }));
		expect(nav.getByRole("heading", { name: "Producto" })).toBeInTheDocument();
		expect(nav.getByRole("heading", { name: "Empresa" })).toBeInTheDocument();
		expect(nav.getByRole("heading", { name: "Aviso legal" })).toBeInTheDocument();
		expect(nav.getByRole("link", { name: "Condiciones" })).toBeInTheDocument();
		expect(nav.getByText("Mercado")).toBeInTheDocument();
		expect(nav.getAllByText("Pronto").length).toBeGreaterThan(0);
		expect(screen.getByText(/Todos los derechos reservados/)).toBeInTheDocument();
	});

	it("keeps the reader in the language from page to page: every link to a page of the site carries the language", () => {
		inSpanish(<Footer />);
		const nav = within(screen.getByRole("navigation", { name: "Mapa del sitio" }));
		expect(nav.getByRole("link", { name: "Condiciones" })).toHaveAttribute("href", "/es/terms");
		expect(nav.getByRole("link", { name: "Documentos" })).toHaveAttribute("href", "/es/papers");
		// Another site, and the plain files, are left exactly as they were.
		expect(nav.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs",
		);
		expect(nav.getByRole("link", { name: "AI index" })).toHaveAttribute("href", "/llms.txt");
		for (const link of nav.getAllByRole("link")) {
			const href = link.getAttribute("href") ?? "";
			if (href.startsWith("/") && !/\.[a-z]+$/.test(href))
				expect(href, href).toMatch(/^\/es(\/|$)/);
		}
	});

	it("shows the code of the language of the page on its language box", () => {
		inSpanish(<Footer />);
		expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("ES");
	});
});

describe("the header in another language", () => {
	it("says its words in that language, and every link to a page of the site carries the language", () => {
		inSpanish(<Header authUrl={AUTH} navigate={() => {}} />);
		const pages = within(screen.getByRole("navigation", { name: "Pages" }));
		expect(pages.getByRole("button", { name: "Producto" })).toBeInTheDocument();
		expect(pages.getByRole("link", { name: "Documentos" })).toHaveAttribute("href", "/es/papers");
		expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
			"href",
			`${AUTH}/sign-in`,
		);
		expect(screen.getByRole("link", { name: /Probar Maschina/ })).toHaveAttribute(
			"href",
			`${AUTH}/sign-up`,
		);
		expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
	});

	it("opens the dropdown with the names in that language, and links its pages inside that language", () => {
		inSpanish(<Header authUrl={AUTH} navigate={() => {}} />);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Producto" }));
		const panel = within(screen.getByRole("region", { name: "Producto" }));
		expect(panel.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/es/product");
		expect(panel.getByText("Mercado")).toBeInTheDocument();
		expect(panel.getAllByText("Pronto").length).toBeGreaterThan(0);
	});

	it("searches in the reader's language and goes to the page in that language", () => {
		const navigate = vi.fn();
		inSpanish(<Header authUrl={AUTH} navigate={navigate} />);
		fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
		const box = screen.getByRole("searchbox", { name: "Buscar en Maschina" });
		fireEvent.change(box, { target: { value: "documentos" } });
		const hit = screen
			.getAllByRole("link", { name: /Documentos/ })
			.find((link) => link.hasAttribute("data-active"));
		expect(hit).toHaveAttribute("href", "/es/papers");
		fireEvent.keyDown(box, { key: "Enter" });
		expect(navigate).toHaveBeenLastCalledWith("/es/papers");
		fireEvent.change(box, { target: { value: "zzzz" } });
		expect(screen.getByText("Ninguna página coincide.")).toBeInTheDocument();
	});
});

describe("the cookie toast in another language", () => {
	it("asks in that language", () => {
		inSpanish(<PreferencesToast />);
		act(() => {
			window.dispatchEvent(new Event(OPEN_PREFERENCES));
		});
		const toast = screen.getByRole("dialog", { name: "Preferencias de cookies" });
		expect(within(toast).getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
		expect(within(toast).getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
	});
});
