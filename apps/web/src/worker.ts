/**
 * What Cloudflare runs in front of the built app: it serves the licensed fonts from private storage and
 * everything else from the build. The fonts never sit in this repository; a licence covers serving
 * them for this site, not handing the files to everyone who clones it.
 */

type FontObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };

export type Env = {
	/** The built app. */
	ASSETS: { fetch(request: Request): Promise<Response> };
	/** The private bucket the font files live in. */
	FONTS: { get(key: string): Promise<FontObject | null> };
};

/** Only a plain font file name is ever looked up: no paths, nothing else in the bucket. */
const FONT = /^[A-Za-z0-9-]+\.(woff2|otf)$/;

export async function handle(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/fonts/")) return env.ASSETS.fetch(request);

	const name = url.pathname.slice("/fonts/".length);
	if (!FONT.test(name)) return new Response("Not found", { status: 404 });
	const font = await env.FONTS.get(name);
	if (!font) return new Response("Not found", { status: 404 });
	return new Response(font.body, {
		headers: {
			"content-type":
				font.httpMetadata?.contentType ?? (name.endsWith(".otf") ? "font/otf" : "font/woff2"),
			// A font file never changes under the same name, so browsers may keep it for a year.
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
}

export default { fetch: handle };
