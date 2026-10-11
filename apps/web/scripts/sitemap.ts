/**
 * Writes public/sitemap.xml: every page that has something on it, in every language, each address naming the same
 * page in all the others. Run it after a page or a language is added: node --experimental-strip-types scripts/sitemap.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_PATHS } from "../src/content-paths.ts";
import { LOCALES, type LocaleCode, localizePath } from "../src/i18n/locales.ts";

const ORIGIN = "https://maschina.dev";
const address = (code: LocaleCode, path: string) => `${ORIGIN}${localizePath(path, code)}`;

const entries = CONTENT_PATHS.flatMap((path) =>
	LOCALES.map((l) => {
		const links = [
			...LOCALES.map(
				(o) =>
					`\t\t<xhtml:link rel="alternate" hreflang="${o.tag}" href="${address(o.code, path)}"/>`,
			),
			`\t\t<xhtml:link rel="alternate" hreflang="x-default" href="${address("en", path)}"/>`,
		];
		return `\t<url>\n\t\t<loc>${address(l.code, path)}</loc>\n${links.join("\n")}\n\t</url>`;
	}),
);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
const file = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "sitemap.xml");
writeFileSync(file, xml);
console.log(`${entries.length} addresses`);
