/**
 * Where a person is sent once they are signed in.
 *
 * A sign in link can say where to go afterwards, and that is a door: a link that sends a freshly signed in person to
 * somebody else's page is how they get tricked into typing a password there. So only a Maschina address is ever
 * followed (https, `maschina.dev` or one of its subdomains, no credentials in the address), or the app's own address
 * when that is local during development. Anything else, however it is written, is the app.
 */
export function safeNext(raw: string | null, appUrl: string): string {
	if (!raw) return appUrl;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return appUrl;
	}
	if (url.username || url.password) return appUrl;
	const maschina =
		url.protocol === "https:" &&
		(url.hostname === "maschina.dev" || url.hostname.endsWith(".maschina.dev"));
	const localApp = url.origin === new URL(appUrl).origin;
	if (!maschina && !localApp) return appUrl;
	// A bare address is written without the slash the parser adds, the way the app's own address is.
	return url.href === `${url.origin}/` ? url.origin : url.href;
}
