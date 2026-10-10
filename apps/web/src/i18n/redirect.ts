import { type LocaleCode, localizePath, parsePath } from "./locales.ts";

/**
 * Where an address should send the visitor, or nothing if it should stay. Only two things ever move a visitor, and both
 * are their own doing:
 * - an address with no language, when they have chosen one that is ready, goes to the same page in it;
 * - an address with a language that is not ready goes to the same page in English, so nobody lands on a page in a
 *   language that is not all there.
 * An address that names a language that is ready is never moved: what was asked for wins over what was chosen before.
 * Nothing the browser or the network says about the visitor is read.
 */
export function redirectFor(
	pathname: string,
	search: string,
	hash: string,
	chosen: LocaleCode | null,
	available: readonly LocaleCode[],
): string | null {
	const here = `${pathname}${search}${hash}`;
	const parsed = parsePath(pathname);
	if (parsed.locale !== "en") {
		if (available.includes(parsed.locale)) return null;
		return localizePath(`${parsed.path}${search}${hash}`, "en");
	}
	if (!chosen || chosen === "en" || !available.includes(chosen)) return null;
	const target = localizePath(here, chosen);
	return target === here ? null : target;
}
