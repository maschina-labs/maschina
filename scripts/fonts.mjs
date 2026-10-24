#!/usr/bin/env node
/**
 * Fetches the licensed fonts into each app's public folder, for local work.
 *
 * The files are not in this repository. A font licence covers serving the font for your own site, not
 * handing the files to everybody who clones it, so they live in a private Cloudflare R2 bucket,
 * `maschina-fonts`, the same one production serves them from: each app's Worker reads `/fonts/*` out of
 * that bucket (see any app's `wrangler.jsonc` and `src/worker.ts`). Locally there is no Worker in front
 * of Vite, so the files have to sit in `public/fonts` instead.
 *
 *   pnpm fonts
 *
 * Which files are fetched is not a list kept here: it is read out of each app's own stylesheet and page,
 * so adding a weight to the CSS is all it takes. An app that names no font of its own is skipped.
 *
 * Without them every app still builds, runs and falls back to the system stack. Nothing breaks; it just
 * looks like somebody else's website.
 *
 * It needs a wrangler that is signed in to the Cloudflare account, which is the same thing a deploy
 * needs. MASCHINA_FONTS_BUCKET overrides the bucket.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The bucket holds plain file names and nothing else, so that is all a page may ask for. */
const FONT = /^[A-Za-z0-9-]+\.(?:woff2|otf)$/;

/**
 * Every font file a stylesheet or a page asks for from this site, in the order it first names them.
 * Anything with a path, a query or another host in it is not one of ours, so it is left alone.
 */
export function fontsWanted(text) {
	const found = [];
	for (const [, name] of text.matchAll(/["'(]\/fonts\/([^"')]+)["')]/g)) {
		if (FONT.test(name) && !found.includes(name)) found.push(name);
	}
	return found;
}

/** A Worker with no bucket binding serves no file from it: a redirect has no page to ask for a font. */
function servesFonts(appsDir, app) {
	const config = join(appsDir, app, "wrangler.jsonc");
	return !existsSync(config) || readFileSync(config, "utf8").includes('"FONTS"');
}

/** Each app that asks for fonts of its own: what it wants and where it wants it, apps in order. */
export function whatToFetch(appsDir) {
	const work = [];
	for (const app of readdirSync(appsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()) {
		if (!servesFonts(appsDir, app)) continue;
		const text = ["src/styles.css", "index.html"]
			.map((file) => join(appsDir, app, file))
			.filter((path) => existsSync(path))
			.map((path) => readFileSync(path, "utf8"))
			.join("\n");
		const fonts = fontsWanted(text);
		if (fonts.length > 0) work.push({ app, into: join(appsDir, app, "public", "fonts"), fonts });
	}
	return work;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const bucket = process.env["MASCHINA_FONTS_BUCKET"] ?? "maschina-fonts";
	const work = whatToFetch(fileURLToPath(new URL("../apps/", import.meta.url)));

	for (const { app, into, fonts } of work) {
		mkdirSync(into, { recursive: true });
		for (const font of fonts) {
			try {
				execFileSync(
					"npx",
					[
						"wrangler",
						"r2",
						"object",
						"get",
						`${bucket}/${font}`,
						"--file",
						join(into, font),
						"--remote",
					],
					{ stdio: ["ignore", "ignore", "inherit"] },
				);
			} catch {
				console.error(`Could not fetch ${font} from ${bucket}.`);
				console.error("The apps still build and run; they fall back to the system font stack.");
				process.exit(0);
			}
		}
		console.log(`${fonts.length} font files in apps/${app}/public/fonts.`);
	}
}
