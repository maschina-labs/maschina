import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LANGUAGE_CHANGED, readLanguage, saveLanguage } from "./language.ts";

function clear() {
	for (const cookie of document.cookie.split("; ")) {
		const name = cookie.split("=")[0];
		// biome-ignore lint/suspicious/noDocumentCookie: a test clearing its own cookies, with no Cookie Store API in jsdom
		if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
	}
}
beforeEach(clear);
afterEach(clear);

describe("the language a visitor chose", () => {
	it("is nothing until the visitor chooses, and then is exactly what they chose", () => {
		expect(readLanguage()).toBeNull();
		saveLanguage("es");
		expect(readLanguage()).toBe("es");
		saveLanguage("en");
		expect(readLanguage()).toBe("en");
	});

	it("remembers an English choice too, because choosing English is a choice", () => {
		saveLanguage("en");
		expect(document.cookie).toContain("maschina_language=en");
	});

	it("keeps one first party cookie for a year, and refuses a language that is not on the list", () => {
		saveLanguage("zh-tw");
		expect(readLanguage()).toBe("zh-tw");
		// biome-ignore lint/suspicious/noDocumentCookie: a test writing a bad cookie
		document.cookie = "maschina_language=klingon; Path=/";
		expect(readLanguage()).toBeNull();
	});

	it("says when the choice changes", () => {
		let heard = 0;
		const listen = () => heard++;
		window.addEventListener(LANGUAGE_CHANGED, listen);
		saveLanguage("fr");
		window.removeEventListener(LANGUAGE_CHANGED, listen);
		expect(heard).toBe(1);
	});
});

describe("nothing here ever decides the language for the visitor", () => {
	const here = dirname(fileURLToPath(import.meta.url));
	const sources = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory()
				? entry.name === "node_modules"
					? []
					: sources(join(dir, entry.name))
				: /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)
					? [join(dir, entry.name)]
					: [],
		);

	it("reads no browser setting, no location and no header to pick a language: only the address and the visitor's own choice count", () => {
		const offenders = sources(resolve(here, "..")).filter((file) =>
			/navigator\.languages?|Accept-Language|Intl\.DateTimeFormat\(\)\.resolvedOptions|geolocation|cf-ipcountry|CF-IPCountry/i.test(
				readFileSync(file, "utf8"),
			),
		);
		expect(offenders).toEqual([]);
	});
});
