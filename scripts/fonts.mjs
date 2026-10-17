#!/usr/bin/env node
/**
 * Fetches the licensed fonts into each app's public folder.
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

// Both apps serve the same licensed files from their own public folder: the dashboard and the front pages.
const into = ["app", "web"].map((app) =>
	fileURLToPath(new URL(`../apps/${app}/public/fonts/`, import.meta.url)),
);
const from = process.env["MASCHINA_FONTS_FROM"] ?? "ubuntu@148.113.245.175:/opt/maschina/fonts/*";
const key = process.env["MASCHINA_FONTS_KEY"] ?? `${process.env["HOME"]}/.ssh/maschina_ovh`;

for (const folder of into) mkdirSync(folder, { recursive: true });

try {
	const options = existsSync(key) ? ["-i", key] : [];
	for (const folder of into)
		execFileSync("scp", [...options, "-o", "BatchMode=yes", "-q", from, folder], {
			stdio: "inherit",
		});
} catch {
	console.error(`Could not fetch the fonts from ${from}.`);
	console.error("The apps still build and run; they fall back to the system font stack.");
	process.exit(0);
}

for (const folder of into) {
	const got = readdirSync(folder).filter((name) => /\.(woff2|otf)$/.test(name));
	console.log(`${got.length} font files in ${folder.replace(/.*\/apps\//, "apps/")}`);
}
