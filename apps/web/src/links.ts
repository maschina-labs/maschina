/** Documentation shares the company site's origin and language paths. */
export const DOCS = "/docs";

/** The status page: run by Better Stack on its own address, so it stays up when we are down. */
export const STATUS = "https://status.maschina.dev";

/** The public record shares the company site. */
export const LIVE = "/live";

/** The documentation pages linked by the menus and footer. */
export const DOCS_PAGES = {
	quickstart: `${DOCS}/quickstart`,
	api: `${DOCS}/api`,
	sdk: `${DOCS}/sdk`,
	spec: `${DOCS}/machine-spec`,
	templates: `${DOCS}/templates`,
	examples: `${DOCS}/examples`,
} as const;
