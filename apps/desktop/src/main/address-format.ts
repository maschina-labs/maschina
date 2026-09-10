/**
 * What counts as a control plane address.
 *
 * Split out from `address.ts` so it can be proved. That module reads and writes
 * a file under Electron's `userData` and therefore imports `electron`, which the
 * proofs cannot load because they run in plain Node. This half is pure, so it can
 * be imported and exercised with real inputs rather than checked by reading the
 * source and hoping the prose matches the code.
 *
 * It is the half worth proving anyway. The address is typed by a person and then
 * concatenated into every request URL, so what it refuses is a security property
 * and not a formatting preference.
 */

/** Offered when nothing is set. What `pnpm dev` serves, on this machine. */
export const SUGGESTED = "http://127.0.0.1:8787";

/**
 * A problem with this address, or null when there is none.
 *
 * Checked once here rather than trusted at each call site.
 */
export function validate(input: string): string | null {
	const text = input.trim();
	if (text === "") return `Enter an address, for example ${SUGGESTED}`;

	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return `"${text}" is not an address. It needs a scheme, as in ${SUGGESTED}`;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return `The address has to be http or https, not ${url.protocol.replace(":", "")}.`;
	}
	if (url.hostname === "") return "The address has no host.";
	// A password in the address would be repeated back in every unreachable
	// message and every log line that names where the window was pointed.
	if (url.username !== "" || url.password !== "") {
		return "Leave credentials out of the address.";
	}
	if (url.search !== "" || url.hash !== "") {
		return "The address is a host, not a query. Drop anything after the path.";
	}
	return null;
}

/** Trailing slash removed, so joining a path never produces a double slash. */
export function tidy(input: string): string {
	const text = input.trim();
	return text.endsWith("/") ? text.slice(0, -1) : text;
}
