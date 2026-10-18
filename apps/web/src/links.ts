/**
 * Where the documentation lives. The part that teaches a person to run their first machine is a page on this site,
 * because a page that exists beats a subdomain that does not. The reference material the quickstart does not cover,
 * the API, the SDK, the machine spec, the templates and the examples, waits for the docs app.
 */
export const DOCS = "/docs";

/** The docs app, for the reference pages that are not written yet. */
const DOCS_APP = "https://docs.maschina.dev";

/** The status page: run by Better Stack on its own address, so it stays up when we are down. */
export const STATUS = "https://status.maschina.dev";

/** The live record: its own app on its own address, so no page here is called /live (an old link to it is redirected). */
export const LIVE = "https://live.maschina.dev";

/** The pages of the docs app that the menus and the footer name, by their address in it. */
export const DOCS_PAGES = {
	// The quickstart is the page on this site. Everything else still waits for the docs app.
	quickstart: DOCS,
	api: `${DOCS_APP}/api`,
	sdk: `${DOCS_APP}/sdk`,
	spec: `${DOCS_APP}/machine-spec`,
	templates: `${DOCS_APP}/templates`,
	examples: `${DOCS_APP}/examples`,
} as const;
