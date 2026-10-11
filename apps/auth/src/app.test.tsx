import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthApp } from "./app.tsx";
import type { PeopleApi } from "./people-api.ts";

const APP = "https://app.maschina.dev";

function setup(path: string, search = "", over: Partial<PeopleApi> = {}) {
	const api = {
		signInEmail: vi.fn(async () => ({ ok: true as const })),
		signUpEmail: vi.fn(async () => ({ ok: true as const })),
		requestReset: vi.fn(async () => ({ ok: true as const })),
		resetPassword: vi.fn(async () => ({ ok: true as const })),
		startSocial: vi.fn(async () => ({ ok: true as const, url: "https://accounts.google.com/x" })),
		startSso: vi.fn(async () => ({ ok: true as const, url: "https://company.okta.com/sso" })),
		...over,
	} satisfies PeopleApi;
	const go = vi.fn();
	render(
		<AuthApp
			path={path}
			search={search}
			api={api}
			appUrl={APP}
			origin="https://auth.maschina.dev"
			go={go}
		/>,
	);
	return { api, go };
}

const type = (label: RegExp | string, value: string) =>
	fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("signing in", () => {
	it("is the first screen, and offers every way in", () => {
		setup("/");
		expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Continue with a wallet" })).toHaveAttribute(
			"href",
			`${APP}/sign-in`,
		);
		expect(screen.getByRole("button", { name: "Sign in with your company" })).toBeInTheDocument();
	});

	it("signs in with an email and a password, then goes to the app", async () => {
		const { api, go } = setup("/sign-in");
		type("Email", "a@example.com");
		type("Password", "a long enough password");
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		await waitFor(() => expect(go).toHaveBeenCalledWith(APP));
		expect(api.signInEmail).toHaveBeenCalledWith("a@example.com", "a long enough password");
	});

	it("goes where it was asked to, when that is a Maschina address, and never anywhere else", async () => {
		const asked = setup("/sign-in", "?next=https%3A%2F%2Fmaschina.dev%2Fes");
		type("Email", "a@example.com");
		type("Password", "pw pw pw pw pw");
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		await waitFor(() => expect(asked.go).toHaveBeenCalledWith("https://maschina.dev/es"));
	});

	it("sends a stranger's address to the app instead", async () => {
		const evil = setup("/sign-in", "?next=https%3A%2F%2Fevil.example");
		type("Email", "a@example.com");
		type("Password", "pw pw pw pw pw");
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		await waitFor(() => expect(evil.go).toHaveBeenCalledWith(APP));
	});

	it("says what went wrong, in words, and goes nowhere", async () => {
		const { go } = setup("/sign-in", "", {
			signInEmail: vi.fn(async () => ({
				ok: false as const,
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "That email and password do not match.",
			})),
		});
		type("Email", "a@example.com");
		type("Password", "wrong wrong wrong");
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"That email and password do not match.",
		);
		expect(go).not.toHaveBeenCalled();
	});

	it("goes to Google and GitHub, and to a company's own sign in by its email", async () => {
		const { api, go } = setup("/sign-in");
		fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
		await waitFor(() => expect(go).toHaveBeenCalledWith("https://accounts.google.com/x"));
		expect(api.startSocial).toHaveBeenCalledWith("google", APP);
		fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
		await waitFor(() => expect(api.startSocial).toHaveBeenCalledWith("github", APP));

		fireEvent.click(screen.getByRole("button", { name: "Sign in with your company" }));
		type("Work email", "a@company.com");
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		await waitFor(() => expect(go).toHaveBeenCalledWith("https://company.okta.com/sso"));
		expect(api.startSso).toHaveBeenCalledWith("a@company.com", APP);
	});

	it("says so when Google cannot be started", async () => {
		setup("/sign-in", "", {
			startSocial: vi.fn(async () => ({
				ok: false as const,
				code: "offline",
				message: "Maschina could not be reached.",
			})),
		});
		fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("could not be reached");
	});

	it("links to making an account and to a new password, keeping where it was going", () => {
		setup("/sign-in", "?next=https%3A%2F%2Fmaschina.dev%2Fes");
		expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
			"href",
			"/sign-up?next=https%3A%2F%2Fmaschina.dev%2Fes",
		);
		expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
			"href",
			"/forgot",
		);
	});
});

describe("making an account", () => {
	it("sends the details and the page the email's link should open, then says to check the email", async () => {
		const { api } = setup("/sign-up");
		type("Name", "Ash");
		type("Email", "a@example.com");
		type("Password", "a long enough password");
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		expect(await screen.findByRole("heading", { name: "Check Your Email" })).toBeInTheDocument();
		expect(api.signUpEmail).toHaveBeenCalledWith(
			"Ash",
			"a@example.com",
			"a long enough password",
			`https://auth.maschina.dev/verified?next=${encodeURIComponent(APP)}`,
		);
		expect(screen.getByText(/a@example.com/)).toBeInTheDocument();
	});

	it("does not send a password shorter than ten characters, and says why", () => {
		const { api } = setup("/sign-up");
		type("Name", "Ash");
		type("Email", "a@example.com");
		type("Password", "short");
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		expect(screen.getByRole("alert")).toHaveTextContent("at least 10");
		expect(api.signUpEmail).not.toHaveBeenCalled();
	});

	it("says what went wrong when it is refused", async () => {
		setup("/sign-up", "", {
			signUpEmail: vi.fn(async () => ({
				ok: false as const,
				code: "USER_ALREADY_EXISTS",
				message: "There is already an account with that email. Sign in instead.",
			})),
		});
		type("Name", "Ash");
		type("Email", "a@example.com");
		type("Password", "a long enough password");
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("already an account");
	});
});

describe("a new password", () => {
	it("asks for the email and says the same thing whether or not there is an account", async () => {
		const { api } = setup("/forgot");
		type("Email", "a@example.com");
		fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
		expect(await screen.findByText(/If there is an account/)).toBeInTheDocument();
		expect(api.requestReset).toHaveBeenCalledWith(
			"a@example.com",
			"https://auth.maschina.dev/reset",
		);
	});

	it("takes the new password with the token from the link, then offers to sign in", async () => {
		const { api } = setup("/reset", "?token=abc");
		type("New password", "a brand new password");
		fireEvent.click(screen.getByRole("button", { name: "Save the password" }));
		expect(await screen.findByText(/password is changed/i)).toBeInTheDocument();
		expect(api.resetPassword).toHaveBeenCalledWith("abc", "a brand new password");
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
	});

	it("says the link is no good when it has no token, and refuses a short password", () => {
		const { api } = setup("/reset");
		expect(screen.getByRole("alert")).toHaveTextContent(/link/i);
		expect(api.resetPassword).not.toHaveBeenCalled();
	});

	it("refuses a short new password before sending it", () => {
		const { api } = setup("/reset", "?token=abc");
		type("New password", "short");
		fireEvent.click(screen.getByRole("button", { name: "Save the password" }));
		expect(screen.getByRole("alert")).toHaveTextContent("at least 10");
		expect(api.resetPassword).not.toHaveBeenCalled();
	});
});

describe("after the link in the email", () => {
	it("says the email is confirmed and goes on to the app", () => {
		setup("/verified", `?next=${encodeURIComponent(APP)}`);
		expect(screen.getByRole("heading", { name: "Email Confirmed" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", APP);
	});

	it("is the sign in screen for any address nobody has heard of", () => {
		setup("/nowhere");
		expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
	});
});

describe("the browser tab", () => {
	it.each([
		["/sign-in", "Sign In"],
		["/sign-up", "Sign Up"],
		["/forgot", "Forgot Password"],
		["/reset", "Reset Password"],
		["/verified", "Email Confirmed"],
		["/", "Sign In"],
	])("names %s as %s, in Title Case, after the page", (path, name) => {
		setup(path);
		expect(document.title).toBe(`${name} | Maschina`);
	});
});
