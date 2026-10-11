/**
 * Where sign in and sign up live. The auth app is not built yet, so until it is they lead to the app, which signs in
 * with a wallet and sends /sign-up to /sign-in. When auth.maschina.dev exists, VITE_AUTH_URL points there and this
 * line can change with it.
 */
export function authUrlFrom(value: string | undefined): string {
	return value ? value : "https://app.maschina.dev";
}
