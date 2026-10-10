/**
 * The visitor's choice about optional cookies, kept in one first party cookie for a year. Nothing is stored until a
 * choice is made, and a cookie that holds anything but accepted or declined counts as no choice. Essential cookies,
 * such as the one that keeps you signed in, are not covered by this and always stay on.
 */
const NAME = "maschina_preferences";
const YEAR = 365 * 24 * 60 * 60;

export type Preference = "accepted" | "declined";

export function readPreference(): Preference | null {
	const found = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${NAME}=`));
	const value = found?.slice(NAME.length + 1);
	return value === "accepted" || value === "declined" ? value : null;
}

export function savePreference(value: Preference): void {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet, and one plain cookie is all this needs
	document.cookie = `${NAME}=${value}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`;
}

/** The event that opens the toast, sent by the footer's Preferences link and heard by the toast. */
export const OPEN_PREFERENCES = "maschina:preferences";
export const openPreferences = () => window.dispatchEvent(new Event(OPEN_PREFERENCES));
