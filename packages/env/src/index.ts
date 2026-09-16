/**
 * Every service reads its configuration through here, once, at startup. A missing or malformed
 * variable stops the service with a message naming every problem at once, and never prints a value,
 * since values are often secrets.
 */

import { MaschinaError } from "@maschina/core";
import { z } from "zod";

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Validates `source` against `schema`, or throws listing every problem by variable name. */
export function loadEnv<Shape extends z.ZodRawShape>(
	shape: Shape,
	source: EnvSource = process.env,
): z.infer<z.ZodObject<Shape>> {
	const result = z.object(shape).safeParse(normalise(source));
	if (result.success) return result.data;

	const problems = result.error.issues.map((issue) => {
		const key = issue.path.join(".") || "(root)";
		return `  ${key}: ${describe(issue)}`;
	});
	throw new MaschinaError(
		"invalid_input",
		`Environment is not valid:\n${problems.join("\n")}\nSee .env.example.`,
		{ details: { variables: result.error.issues.map((i) => i.path.join(".")) } },
	);
}

/** Empty strings in .env files mean "not set", so optional variables behave as optional. */
function normalise(source: EnvSource): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(source)) out[key] = value === "" ? undefined : value;
	return out;
}

function describe(issue: z.core.$ZodIssue): string {
	if (issue.code === "invalid_type" && issue.input === undefined) return "is required";
	return issue.message;
}

/** Common variable types, so every service validates them the same way. */
export const env = {
	nodeEnv: () => z.enum(["development", "test", "production"]).default("development"),
	logLevel: () =>
		z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	port: (fallback: number) => z.coerce.number().int().min(1).max(65_535).default(fallback),
	url: () => z.url(),
	postgresUrl: () =>
		z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), "must be a postgres:// URL"),
	/** A shared secret. Long enough that guessing is not a strategy. */
	secret: () =>
		z
			.string()
			.min(32, "must be at least 32 characters")
			.refine((value) => !value.startsWith("replace-with"), "is still the placeholder value"),
	list: () =>
		z.string().transform((value) =>
			value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		),
	optional: <T extends z.ZodType>(schema: T) => schema.optional(),
};

/** Variables every service reads. */
export const serviceEnv = {
	NODE_ENV: env.nodeEnv(),
	LOG_LEVEL: env.logLevel(),
	SENTRY_DSN: env.optional(env.url()),
	/** Set by the release pipeline. */
	SERVICE_VERSION: z.string().default("dev"),
};
