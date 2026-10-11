/**
 * People who sign in without a wallet: the tables Better Auth keeps.
 *
 * Better Auth owns who a person is (their email, how they proved it, the providers they came through) and
 * these tables are exactly the shape it asks for, named apart from this package's own wallet `sessions` so
 * the two cannot be mistaken for each other. An owner is linked to a person in `owners.user_id`; nothing
 * here knows about machines or money.
 */

import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const at = (name: string) => timestamp(name, { withTimezone: true });

export const authUsers = pgTable("auth_users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: at("created_at").defaultNow().notNull(),
	updatedAt: at("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const authSessions = pgTable(
	"auth_sessions",
	{
		id: text("id").primaryKey(),
		expiresAt: at("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: at("created_at").defaultNow().notNull(),
		updatedAt: at("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
	},
	(table) => [index("auth_sessions_user").on(table.userId)],
);

export const authAccounts = pgTable(
	"auth_accounts",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: at("access_token_expires_at"),
		refreshTokenExpiresAt: at("refresh_token_expires_at"),
		scope: text("scope"),
		/** The hash of a password, never the password. */
		password: text("password"),
		createdAt: at("created_at").defaultNow().notNull(),
		updatedAt: at("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("auth_accounts_user").on(table.userId)],
);

export const authVerifications = pgTable(
	"auth_verifications",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: at("expires_at").notNull(),
		createdAt: at("created_at").defaultNow().notNull(),
		updatedAt: at("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("auth_verifications_identifier").on(table.identifier)],
);

/** A company's single sign-on: the identity provider (Okta, Entra, Google Workspace) a domain signs in through. */
export const authSsoProviders = pgTable("auth_sso_providers", {
	id: text("id").primaryKey(),
	issuer: text("issuer").notNull(),
	oidcConfig: text("oidc_config"),
	samlConfig: text("saml_config"),
	userId: text("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
	providerId: text("provider_id").notNull().unique(),
	organizationId: text("organization_id"),
	domain: text("domain").notNull(),
});
