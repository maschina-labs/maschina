import type { Context } from "hono";

/**
 * The name, drawn in plain ASCII so it survives any terminal. Five rows of letters five columns wide, two columns
 * apart: under 80 columns, nothing outside the printable range.
 */
export const ART = [
	"#   #   ###    ####   ####  #   #  #####  #   #   ###",
	"## ##  #   #  #      #      #   #    #    ##  #  #   #",
	"# # #  #####   ###   #      #####    #    # # #  #####",
	"#   #  #   #      #  #      #   #    #    #  ##  #   #",
	"#   #  #   #  ####    ####  #   #  #####  #   #  #   #",
];

const WEBSITE = "https://maschina.dev";

/**
 * What the API says to someone who knocks on its front door instead of calling a route: a welcome, not an error,
 * because nothing is wrong. A program that asks for anything gets JSON, with where to look next. A person in a browser,
 * or a terminal that asks for text, gets the name drawn in ASCII with the same words under it.
 */
export function welcome(version: string) {
	return (c: Context) => {
		const message = `Welcome to the Maschina API. The website is at ${WEBSITE}.`;
		const links = { website: WEBSITE, openapi: "/openapi.json", health: "/v1/status" };
		// The same address answers two ways, so a cache must keep them apart.
		c.header("vary", "Accept");
		const accept = c.req.header("accept") ?? "";
		if (/text\/(html|plain)/.test(accept))
			return c.text(
				[
					"",
					...ART,
					"",
					message,
					"",
					`  version   ${version}`,
					`  status    ${links.health}`,
					`  openapi   ${links.openapi}`,
					`  website   ${links.website}`,
					"",
				].join("\n"),
			);
		return c.json({ name: "Maschina API", version, status: "ok", message, ...links });
	};
}
