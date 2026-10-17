import { type EnvSource, env, loadEnv, serviceEnv, statusHeartbeatEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			...statusHeartbeatEnv("GATEWAY"),
			GATEWAY_PORT: env.port(4000),
			GATEWAY_CORS_ORIGINS: env.list(),
			DATABASE_URL: env.postgresUrl(),
			/** Where machines are created. The gateway never holds a wallet provider key itself. */
			PROVISIONER_URL: env.url(),
			PROVISIONER_GATEWAY_TOKEN: env.secret(),
			/**
			 * Where an owner's withdrawal is asked for, and the token that proves it is the gateway asking.
			 * Either one missing and withdrawals answer that they are not switched on, rather than the
			 * gateway refusing to start.
			 */
			ORCHESTRATOR_URL: env.optional(env.url()),
			/** Where balances are read from. Unset, a machine's balances cannot be asked for. */
			SOLANA_RPC_URL: env.optional(env.url()),
			ORCHESTRATOR_GATEWAY_TOKEN: env.optional(env.secret()),
			/**
			 * The domain a sign in message names, and the only domain its signature is good for. Wallets
			 * check it against the page's own origin, which includes the port in development, so this is
			 * a host rather than a hostname.
			 */
			GATEWAY_DOMAIN: z.string().min(1).default("localhost:3002"),
			/** Where the app lives, shown in the message so a person sees what they are signing into. */
			GATEWAY_APP_URL: env.url().default("http://localhost:3002"),
			/**
			 * The parent domain the session cookie is scoped to, so the app and the API share it. Left
			 * unset in development, where there is no shared parent and no https.
			 */
			GATEWAY_COOKIE_DOMAIN: z.string().min(1).optional(),
			/**
			 * The key owners' own secrets are sealed under, such as their AI key: 32 random bytes as base64
			 * (`openssl rand -base64 32`). It lives only here, never in the database, and changing it makes
			 * every stored secret unreadable. Unset, owners cannot give the manager a key.
			 */
			/**
			 * A Jupiter API key, for the paper trader's quotes and prices. Unset, it uses Jupiter's free
			 * tier, shared by everything on the server's address.
			 */
			JUPITER_API_KEY: env.optional(z.string().min(8)),
			/**
			 * The owner whose machines the public record shows, at /v1/public/record.
			 *
			 * An owner rather than a machine, because D-108 says every machine the house owns is shown,
			 * live or paper, running or stopped, and nobody including Ash can hide one. A record that
			 * leaves out the machines that failed proves nothing. Unset, the record is empty and nothing
			 * is shown. It is a choice made here, never a request parameter, so nobody can ask for
			 * somebody else's machines.
			 */
			PUBLIC_RECORD_OWNER_ID: env.optional(z.uuid()),
			/**
			 * The wallets that may put real money into a machine, separated by commas.
			 *
			 * Paper is open to everyone and needs nothing here: a paper machine runs the same code against
			 * live prices and never asks for a signature. Real money is shut until the signer judges a
			 * transaction's own bytes rather than the node's claim about them, and until there has been an
			 * independent audit. Unset means nobody, including Ash: the gate is shut by default, because a
			 * gate that opens when a variable goes missing is not a gate.
			 */
			LIVE_MACHINE_WALLETS: env.optional(z.string()),
			/**
			 * The Resend key (sending only) that the contact page's mail goes out on. Unset, the contact route
			 * answers that it is not available, and nothing pretends to send.
			 */
			RESEND_API_KEY: env.optional(env.secret()),
			/** Where the gateway is reached from outside: where Google, GitHub and a company's identity provider send a person back to. */
			GATEWAY_PUBLIC_URL: env.url().default("http://localhost:4000"),
			/**
			 * What signs a person's session cookie and encrypts what Better Auth stores (`openssl rand -base64 48`).
			 * Unset, signing in with an email, Google, GitHub or a company is off and its routes say so. It also needs
			 * the Resend key, because an address is confirmed by a link sent to it.
			 */
			GATEWAY_AUTH_SECRET: env.optional(env.secret()),
			/** Sign in with Google and with GitHub: an OAuth app's client id and secret. Each is offered only when both are set. */
			GOOGLE_CLIENT_ID: env.optional(z.string().min(1)),
			GOOGLE_CLIENT_SECRET: env.optional(z.string().min(8)),
			GITHUB_CLIENT_ID: env.optional(z.string().min(1)),
			GITHUB_CLIENT_SECRET: env.optional(z.string().min(8)),
			GATEWAY_SECRETS_KEY: z
				.string()
				.refine((value) => Buffer.from(value, "base64").length === 32, "must be 32 bytes as base64")
				.optional(),
		},
		source,
	);
}
