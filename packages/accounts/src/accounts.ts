/**
 * People signing in: an email and a password, Google, GitHub, and a company's single sign-on.
 *
 * Better Auth keeps who a person is and proves how they came in. This module is the thin part around it: the
 * settings that make it safe here (an address is not trusted until its link is opened, passwords are long, the
 * session is a cookie the browser cannot read and every `.maschina.dev` address shares), and the one question the
 * rest of Maschina asks of it: who is this request?
 *
 * A person who signs in this way has an owner with no wallet. Nothing that moves money works for them until they
 * link one, and that is checked where the money moves, not here.
 */

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { sso } from "@better-auth/sso";
import { createOwnerForUser, type Database, schema } from "@maschina/db";
import { betterAuth } from "better-auth";
import { type Mailer, resetMail, verificationMail } from "./mail.ts";

/** Where Better Auth's own routes live, under the gateway's version prefix and apart from the wallet routes. */
export const PEOPLE_PATH = "/v1/auth/people";

/** The cookie that holds a person's session, which every Maschina address under one domain can read. */
export const PERSON_COOKIE_PREFIX = "maschina";

export type SocialProvider = { clientId: string; clientSecret: string };

export type AccountsOptions = {
	db: Database;
	/** What signs the cookies and encrypts what Better Auth stores. At least 32 characters, from the secrets store. */
	secret: string;
	/** The address the gateway is reached at, which Google, GitHub and a company's identity provider send people back to. */
	baseUrl: string;
	/** The pages allowed to start a sign in and to be sent back to: the site, the app and the auth app. */
	trustedOrigins: string[];
	/** The shared parent domain, `maschina.dev`, so a session started at the auth address is read at the app's. Left out in development. */
	cookieDomain?: string | undefined;
	/** False only in development, where there is no https. */
	secureCookies: boolean;
	mailer: Mailer;
	/** Offered only when both halves are given. */
	google?: SocialProvider | undefined;
	github?: SocialProvider | undefined;
	/** Called when an email could not be sent, so it can be reported rather than lost. */
	onMailError?: ((error: unknown) => void) | undefined;
};

export type PersonRef = { ownerId: string; walletAddress: string | null; email: string | null };

export type Accounts = {
	/** Better Auth's routes, answering any request under {@link PEOPLE_PATH}. */
	handler(request: Request): Promise<Response>;
	/** The owner this request's session belongs to, if it carries one. */
	ownerOf(headers: Headers): Promise<PersonRef | undefined>;
};

export function createAccounts(options: AccountsOptions): Accounts {
	const report = options.onMailError ?? (() => undefined);
	// A slow or failing mail service must not slow or reveal anything on the page that asked, so a send is
	// started and not waited on.
	const send = (mail: ReturnType<typeof verificationMail>) => {
		options.mailer.send(mail).catch(report);
	};

	const auth = betterAuth({
		appName: "Maschina",
		secret: options.secret,
		baseURL: options.baseUrl,
		basePath: PEOPLE_PATH,
		trustedOrigins: options.trustedOrigins,
		database: drizzleAdapter(options.db, {
			provider: "pg",
			schema: {
				user: schema.authUsers,
				session: schema.authSessions,
				account: schema.authAccounts,
				verification: schema.authVerifications,
				ssoProvider: schema.authSsoProviders,
			},
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 10,
			maxPasswordLength: 128,
			// An address nobody has opened a link at is not an address anyone has shown is theirs.
			requireEmailVerification: true,
			resetPasswordTokenExpiresIn: 60 * 60,
			sendResetPassword: async ({ user, url }) => {
				send(resetMail(user.email, url));
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 60 * 60,
			sendVerificationEmail: async ({ user, url }) => {
				send(verificationMail(user.email, url));
			},
		},
		socialProviders: {
			...(options.google ? { google: options.google } : {}),
			...(options.github ? { github: options.github } : {}),
		},
		advanced: {
			cookiePrefix: PERSON_COOKIE_PREFIX,
			useSecureCookies: options.secureCookies,
			...(options.cookieDomain
				? { crossSubDomainCookies: { enabled: true, domain: options.cookieDomain } }
				: {}),
		},
		plugins: [sso()],
	});

	return {
		handler: (request) => auth.handler(request),

		async ownerOf(headers) {
			const session = await auth.api.getSession({ headers });
			if (!session) return undefined;
			// Made the first time it is asked for and found every time after, so a person always has one.
			const owner = await createOwnerForUser(options.db, session.user.id);
			if (!owner.ok) throw owner.error;
			return {
				ownerId: owner.value.id,
				walletAddress: owner.value.walletAddress,
				email: session.user.email,
			};
		},
	};
}
