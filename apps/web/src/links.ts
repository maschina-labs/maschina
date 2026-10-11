/**
 * Where the documentation lives: its own app on its own address. Every link to the docs, the quickstart, the API, the
 * SDK, the machine spec, the templates and the examples leaves this site for it, so none of them is a page here.
 */
export const DOCS = "https://docs.maschina.dev";

/** The pages of the docs app that the menus and the footer name, by their address in it. */
export const DOCS_PAGES = {
	quickstart: `${DOCS}/quickstart`,
	api: `${DOCS}/api`,
	sdk: `${DOCS}/sdk`,
	spec: `${DOCS}/machine-spec`,
	templates: `${DOCS}/templates`,
	examples: `${DOCS}/examples`,
} as const;
