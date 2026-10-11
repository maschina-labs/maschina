/**
 * Talking to the gateway's sign in routes, and turning what comes back into plain words.
 *
 * Better Auth answers with codes. A person should never read a code, so the ones that matter are said in a sentence and
 * the rest are said generically. A wrong address and a wrong password are one message, so the screen cannot be used to
 * find out who has an account. The cookie comes back from the gateway and is kept by the browser: nothing here ever
 * holds a session.
 */

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; code: string; message: string };

const SAYS: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "That email and password do not match.",
	EMAIL_NOT_VERIFIED: "Confirm your email first. We sent you a link when you made the account.",
	USER_ALREADY_EXISTS: "There is already an account with that email. Sign in instead.",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"There is already an account with that email. Sign in instead.",
	PASSWORD_TOO_SHORT: "Use a password of at least 10 characters.",
	PASSWORD_TOO_LONG: "That password is too long. Use 128 characters or fewer.",
	INVALID_EMAIL: "That does not look like an email address.",
	INVALID_TOKEN: "That link has expired or was already used. Ask for a new link.",
	TOKEN_EXPIRED: "That link has expired. Ask for a new link.",
	PROVIDER_NOT_FOUND: "Sign in with that is not switched on yet.",
	SSO_PROVIDER_NOT_FOUND: "We could not find a company sign in for that email.",
	NO_PROVIDER_FOUND: "We could not find a company sign in for that email.",
};

const OFFLINE = "Maschina could not be reached. Check your connection and try again.";
const UNAVAILABLE = "Something went wrong on our side. Try again in a moment.";
const SLOW = "Too many tries. Wait a minute and try again.";

export function peopleApi(gateway: string, call: typeof fetch = fetch) {
	async function post(path: string, body: unknown): Promise<Result<{ data: unknown }>> {
		let response: Response;
		try {
			response = await call(`${gateway}/v1/auth/people${path}`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
		} catch {
			return { ok: false, code: "offline", message: OFFLINE };
		}
		if (response.status === 429) return { ok: false, code: "slow_down", message: SLOW };
		let data: Record<string, unknown>;
		try {
			data = (await response.json()) as Record<string, unknown>;
		} catch {
			return { ok: false, code: "unavailable", message: UNAVAILABLE };
		}
		if (response.ok) return { ok: true, data };
		const code = typeof data["code"] === "string" ? data["code"] : "unavailable";
		return { ok: false, code, message: SAYS[code] ?? UNAVAILABLE };
	}

	const plain = async (path: string, body: unknown): Promise<Result> => {
		const done = await post(path, body);
		return done.ok ? { ok: true } : done;
	};

	/** The address to send the person to, which Google, GitHub or their company answers at. */
	const redirect = async (path: string, body: unknown): Promise<Result<{ url: string }>> => {
		const done = await post(path, body);
		if (!done.ok) return done;
		const url = (done.data as { url?: unknown }).url;
		if (typeof url !== "string") {
			return { ok: false, code: "unavailable", message: UNAVAILABLE };
		}
		return { ok: true, url };
	};

	return {
		signInEmail: (email: string, password: string) => plain("/sign-in/email", { email, password }),
		signUpEmail: (name: string, email: string, password: string, callbackURL: string) =>
			plain("/sign-up/email", { name, email, password, callbackURL }),
		requestReset: (email: string, redirectTo: string) =>
			plain("/request-password-reset", { email, redirectTo }),
		resetPassword: (token: string, newPassword: string) =>
			plain("/reset-password", { token, newPassword }),
		startSocial: (provider: "google" | "github", callbackURL: string) =>
			redirect("/sign-in/social", { provider, callbackURL }),
		startSso: (email: string, callbackURL: string) =>
			redirect("/sign-in/sso", { email, callbackURL }),
	};
}

export type PeopleApi = ReturnType<typeof peopleApi>;
