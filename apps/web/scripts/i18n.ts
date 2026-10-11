/**
 * Tools for the translations. Run from apps/web with Node's own type stripping:
 *   node --experimental-strip-types scripts/i18n.ts sources   the English, as the lists a translator fills in
 *   node --experimental-strip-types scripts/i18n.ts seal es   fingerprint the English a translation was made from
 *   node --experimental-strip-types scripts/i18n.ts status    which sentences of each language fell back to English
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, hash, sealOf, sourcesOf } from "../src/i18n/translate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const folder = join(here, "../src/i18n/translations");
const [command, code] = process.argv.slice(2);

if (command === "sources") {
	console.log(JSON.stringify(sourcesOf(), null, 1));
} else if (command === "seal") {
	if (!code || !existsSync(join(folder, `${code}.ts`)))
		throw new Error(`no translation file for "${code}"`);
	writeFileSync(join(folder, `${code}.seal.json`), `${JSON.stringify(sealOf())}\n`);
	console.log(`sealed ${code}`);
} else if (command === "status") {
	const total = Object.values(sourcesOf()).flatMap((part) =>
		Array.isArray(part) ? part : Object.values(part).flat(),
	).length;
	for (const file of existsSync(folder)
		? readdirSync(folder).filter((name) => name.endsWith(".ts"))
		: []) {
		const language = file.replace(/\.ts$/, "");
		const { default: words } = await import(pathToFileURL(join(folder, file)).href);
		const stamps = JSON.parse(readFileSync(join(folder, `${language}.seal.json`), "utf8"));
		const { stale } = build(words, stamps);
		console.log(
			`${language}: ${total - stale} of ${total} translated, ${stale} in English${stale ? " (the English changed, or it is missing)" : ""}`,
		);
	}
	if (!existsSync(folder)) console.log("no translations yet");
	void hash;
} else {
	console.log("usage: sources | seal <code> | status");
}
