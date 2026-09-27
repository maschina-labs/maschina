#!/usr/bin/env node
/**
 * Fetches the licensed fonts into the web app's public folder.
 *
 * The files are not in this repository. A font licence covers serving the font for your own site, not
 * handing the files to everybody who clones it, so they live somewhere only the licence holder can read
 * and are copied in before a build that is going to be deployed.
 *
 *   pnpm fonts
 *
 * Without them the app builds, runs and falls back to the system stack. Nothing breaks; it just looks
 * like somebody else's website.
 *
 * MASCHINA_FONTS_FROM is an scp source, and defaults to the server the rest of Maschina runs on.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const into = fileURLToPath(new URL("../apps/web/public/fonts/", import.meta.url));
const from = process.env["MASCHINA_FONTS_FROM"] ?? "ubuntu@148.113.245.175:/opt/maschina/fonts/*";
const key = process.env["MASCHINA_FONTS_KEY"] ?? `${process.env["HOME"]}/.ssh/maschina_ovh`;

mkdirSync(into, { recursive: true });

try {
	const options = existsSync(key) ? ["-i", key] : [];
	execFileSync("scp", [...options, "-o", "BatchMode=yes", "-q", from, into], { stdio: "inherit" });
} catch {
	console.error(`Could not fetch the fonts from ${from}.`);
	console.error("The app still builds and runs; it falls back to the system font stack.");
	process.exit(0);
}

const got = readdirSync(into).filter((name) => /\.(woff2|otf)$/.test(name));
console.log(`${got.length} font files in apps/web/public/fonts.`);
